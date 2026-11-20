import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { syncEngine } from '../js/sync/sync-engine.js';
import { eventBus } from '../js/utils/event-bus.js';
import { LabelsModule } from '../js/modules/labels.js';
import { ShareModule } from '../js/modules/share.js';
import { db } from '../js/database/indexeddb.js';
import { syncQueue } from '../js/sync/sync-queue.js';

describe('Systematic Automatic Sync Tests', () => {
  test('formatPayloadForFirestore formats notes with userId and updatedAt', () => {
    const noteData = {
      $id: 'note-1',
      title: 'Titre de test',
      content: 'Contenu'
    };

    const payload = syncEngine.formatPayloadForFirestore(noteData, 'notes');
    assert.equal(payload.$id, 'note-1');
    assert.ok(payload.userId);
    assert.ok(payload.updatedAt);
  });

  test('formatPayloadForFirestore for labels removes updatedAt to satisfy Firestore security rules', () => {
    const labelData = {
      $id: 'lbl-1',
      name: 'Travail',
      color: 'blue',
      createdAt: '2026-11-20T10:00:00.000Z',
      updatedAt: '2026-11-20T11:00:00.000Z'
    };

    const payload = syncEngine.formatPayloadForFirestore(labelData, 'labels');
    assert.equal(payload.$id, 'lbl-1');
    assert.equal(payload.name, 'Travail');
    assert.ok(payload.userId);
    assert.equal(payload.updatedAt, undefined, 'updatedAt must not exist on label payloads');
  });

  test('formatPayloadForFirestore for shares assigns ownerId', () => {
    const shareData = {
      $id: 'share-1',
      noteId: 'note-1',
      sharedWith: 'collab@example.com',
      permission: 'read',
      createdAt: '2026-11-20T10:00:00.000Z'
    };

    const payload = syncEngine.formatPayloadForFirestore(shareData, 'shares');
    assert.equal(payload.$id, 'share-1');
    assert.ok(payload.ownerId);
  });

  test('SyncEngine flags syncRequested when syncNow is called while isSyncing is active', async () => {
    syncEngine.isSyncing = true;
    syncEngine.syncRequested = false;

    // Simulate incoming modification while previous sync is executing
    await syncEngine.syncNow();

    assert.equal(syncEngine.syncRequested, true, 'syncRequested must be true when sync is already in flight');
    syncEngine.isSyncing = false;
    syncEngine.syncRequested = false;
  });

  test('triggerSync schedules debounced sync execution without dropping triggers', async () => {
    let triggered = false;
    const origSyncNow = syncEngine.syncNow;
    syncEngine.syncNow = async () => {
      triggered = true;
    };

    syncEngine.triggerSync(10);
    assert.ok(syncEngine.syncDebounceTimer !== null);

    await new Promise(r => setTimeout(r, 25));
    assert.equal(triggered, true);

    syncEngine.syncNow = origSyncNow;
  });

  test('attachLabelToNote and detachLabelFromNote emit sync:trigger', async () => {
    // Mock db and syncQueue methods
    const origSaveNote = db.saveNote;
    const origEnqueue = syncQueue.enqueue;
    db.saveNote = async () => true;
    syncQueue.enqueue = async () => true;

    let syncTriggerCount = 0;
    const unsubscribe = eventBus.on('sync:trigger', () => {
      syncTriggerCount++;
    });

    const mockNote = {
      $id: 'note-10',
      title: 'Note test libellés',
      labels: []
    };

    await LabelsModule.attachLabelToNote(mockNote, 'lbl-urgent');
    assert.ok(mockNote.labels.includes('lbl-urgent'));
    assert.equal(syncTriggerCount, 1, 'attachLabelToNote must emit sync:trigger');

    await LabelsModule.detachLabelFromNote(mockNote, 'lbl-urgent');
    assert.ok(!mockNote.labels.includes('lbl-urgent'));
    assert.equal(syncTriggerCount, 2, 'detachLabelFromNote must emit sync:trigger');

    unsubscribe();
    db.saveNote = origSaveNote;
    syncQueue.enqueue = origEnqueue;
  });

  test('ShareModule.shareWithUser emits sync:trigger', async () => {
    const origGetDB = db.getDB;
    const origEnqueue = syncQueue.enqueue;

    db.getDB = async () => ({
      transaction: () => ({
        objectStore: () => ({
          put: () => {}
        })
      })
    });
    syncQueue.enqueue = async () => true;

    let syncTriggered = false;
    const unsubscribe = eventBus.on('sync:trigger', () => {
      syncTriggered = true;
    });

    await ShareModule.shareWithUser('note-1', 'friend@example.com', 'read');
    assert.equal(syncTriggered, true, 'shareWithUser must emit sync:trigger');

    unsubscribe();
    db.getDB = origGetDB;
    syncQueue.enqueue = origEnqueue;
  });

  test('claimGuestNotes updates userId of local guest notes and enqueues sync', async () => {
    const { auth } = await import('../js/services/auth.js');
    const guestNotes = [
      { $id: 'g-1', title: 'Note invitée', userId: 'guest', updatedAt: '2026-11-20T10:00:00Z' }
    ];

    const origGetAll = db.getAllNotes;
    const origGetLabels = db.getLabels;
    const origSave = db.saveNote;
    const origEnqueue = syncQueue.enqueue;

    let savedNote = null;
    let enqueuedAction = null;

    db.getAllNotes = async () => guestNotes;
    db.getLabels = async () => [];
    db.saveNote = async (n) => { savedNote = n; return n; };
    syncQueue.enqueue = async (col, act, id, data) => {
      enqueuedAction = { col, act, id, data };
    };

    await auth.claimGuestNotes('user-real-123');

    assert.ok(savedNote, 'Guest note must be saved with new userId');
    assert.equal(savedNote.userId, 'user-real-123');
    assert.ok(enqueuedAction);
    assert.equal(enqueuedAction.col, 'notes');
    assert.equal(enqueuedAction.id, 'g-1');

    db.getAllNotes = origGetAll;
    db.getLabels = origGetLabels;
    db.saveNote = origSave;
    syncQueue.enqueue = origEnqueue;
  });

  test('syncEngine automatically activates subscribeRealtime on init when user is already logged in', async () => {
    const { auth } = await import('../js/services/auth.js');
    const { firebase } = await import('../js/services/firebase.js');

    const origIsGuest = Object.getOwnPropertyDescriptor(auth, 'isGuest');
    const origGetUserId = auth.getUserId;
    const origIsConfigured = firebase.isConfigured;

    // Simulate an already authenticated session on page load
    Object.defineProperty(auth, 'isGuest', { value: false, configurable: true });
    auth.getUserId = () => 'user-active-456';
    firebase.isConfigured = true;

    let realtimeSubscribed = false;
    const origSubscribe = syncEngine.subscribeRealtime;
    syncEngine.subscribeRealtime = () => {
      realtimeSubscribed = true;
    };

    // Run init
    await syncEngine.init();

    assert.equal(realtimeSubscribed, true, 'Realtime listener must be subscribed on startup for authenticated user without requiring logout/login');

    syncEngine.subscribeRealtime = origSubscribe;
    if (origIsGuest) Object.defineProperty(auth, 'isGuest', origIsGuest);
    auth.getUserId = origGetUserId;
    firebase.isConfigured = origIsConfigured;
  });
});
