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
});
