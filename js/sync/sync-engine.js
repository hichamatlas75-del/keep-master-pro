/**
 * KEEP MASTER PRO - Bi-Directional Firestore Sync Engine
 * Optimized for Firebase Spark Free Plan:
 * - Batched writes (writeBatch) to minimize quota consumption
 * - Delta synchronization using `updatedAt > lastSyncTime` to eliminate repetitive reads
 * - Anti-loop mechanism via `snapshot.metadata.hasPendingWrites`
 * - Offline-first resilience with IndexedDB as primary store
 */

import { firebase } from '../services/firebase.js';
import { auth } from '../services/auth.js';
import { db } from '../database/indexeddb.js';
import { syncQueue } from './sync-queue.js';
import { ConflictManager } from './conflict-manager.js';
import { APP_CONFIG } from '../config.js';
import { eventBus } from '../utils/event-bus.js';
import { createNoteModel, createLabelModel } from '../database/schema.js';

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.realtimeUnsubscribe = null;
    this.syncInterval = null;
    this.status = APP_CONFIG.SYNC_STATUS.ONLINE;
    this.recentLocalWrites = new Map(); // docId -> timestamp
  }

  /**
   * Initialize sync engine and listeners
   */
  async init() {
    this.updateStatus();

    // Listen to browser network state
    window.addEventListener('online', () => {
      console.log('[SyncEngine] Connexion réseau rétablie.');
      this.updateStatus();
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncEngine] Connexion réseau perdue. Mode 100% hors-ligne.');
      this.setStatus(APP_CONFIG.SYNC_STATUS.OFFLINE, 'Hors ligne');
      this.unsubscribeRealtime();
    });

    // Listen to manual sync triggers
    eventBus.on('sync:trigger', () => this.syncNow());

    // Listen to auth changes
    eventBus.on('auth:change', ({ isGuest }) => {
      if (!isGuest && firebase.isConfigured) {
        this.subscribeRealtime();
        this.syncNow();
      } else {
        this.unsubscribeRealtime();
      }
    });

    // Background sync check every 45 seconds (optimized for Spark quota)
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing && !auth.isGuest && firebase.isConfigured) {
        this.syncNow();
      }
    }, 45000);

    // Initial sync check
    setTimeout(() => this.syncNow(), 1500);
  }

  updateStatus() {
    if (!navigator.onLine) {
      this.setStatus(APP_CONFIG.SYNC_STATUS.OFFLINE, 'Hors ligne');
    } else if (auth.isGuest) {
      this.setStatus(APP_CONFIG.SYNC_STATUS.ONLINE, 'Mode local');
    } else {
      this.setStatus(APP_CONFIG.SYNC_STATUS.ONLINE, 'Prêt');
    }
  }

  setStatus(status, message) {
    this.status = status;
    eventBus.emit('sync:status', { status, message });
  }

  /**
   * Main synchronization routine
   */
  async syncNow() {
    if (this.isSyncing) return;
    if (!navigator.onLine) {
      this.setStatus(APP_CONFIG.SYNC_STATUS.OFFLINE, 'Hors ligne');
      return;
    }

    if (auth.isGuest || !firebase.isConfigured || !firebase.firestore) {
      this.setStatus(APP_CONFIG.SYNC_STATUS.ONLINE, 'Mode local');
      return;
    }

    this.isSyncing = true;
    this.setStatus(APP_CONFIG.SYNC_STATUS.SYNCING, 'Synchronisation...');

    try {
      // 1. Push pending local operations to Firestore via batched writes
      await this.processSyncQueue();

      // 2. Pull remote changes with delta optimization
      await this.pullRemoteNotes();
      await this.pullRemoteLabels();

      const pendingCount = await syncQueue.count();
      if (pendingCount > 0) {
        this.setStatus(APP_CONFIG.SYNC_STATUS.SYNCING, `${pendingCount} en attente`);
      } else {
        this.setStatus(APP_CONFIG.SYNC_STATUS.ONLINE, 'Synchronisé');
      }
    } catch (err) {
      console.warn('[SyncEngine] Avertissement synchronisation Firestore :', err.message);
      this.setStatus(APP_CONFIG.SYNC_STATUS.ONLINE, 'Mode hors-ligne actif');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process pending sync queue using Firestore writeBatch (Quota & performance optimization)
   */
  async processSyncQueue() {
    const operations = await syncQueue.getPendingOperations(40);
    if (!operations || operations.length === 0) return;

    const { doc, writeBatch } = firebase.SDK.firestore;
    const batch = writeBatch(firebase.firestore);
    const opsToDequeue = [];

    for (const op of operations) {
      try {
        const docRef = doc(firebase.firestore, op.collection, op.documentId);

        if (op.action === 'CREATE' || op.action === 'UPDATE') {
          const payload = this.formatPayloadForFirestore(op.data);
          batch.set(docRef, payload, { merge: true });
          this.recentLocalWrites.set(op.documentId, Date.now());
        } else if (op.action === 'DELETE') {
          batch.delete(docRef);
        }

        opsToDequeue.push(op.id);
      } catch (err) {
        console.warn(`[SyncEngine] Erreur préparation batch pour ${op.documentId}:`, err);
      }
    }

    if (opsToDequeue.length > 0) {
      // Commit all batched operations in a single Firestore call!
      await batch.commit();

      // Dequeue all successful operations
      for (const opId of opsToDequeue) {
        await syncQueue.remove(opId);
      }
    }
  }

  /**
   * Format note data for Firestore
   */
  formatPayloadForFirestore(data) {
    if (!data) return {};
    const payload = { ...data };
    payload.userId = auth.getUserId();
    payload.updatedAt = payload.updatedAt || new Date().toISOString();
    return payload;
  }

  /**
   * Delta sync for remote notes (Queries only documents modified since lastSyncTime)
   */
  async pullRemoteNotes() {
    const { collection, query, where, getDocs, limit } = firebase.SDK.firestore;
    const notesCol = collection(firebase.firestore, 'notes');
    const uid = auth.getUserId();

    const lastSyncTime = await db.getSetting(`last_sync_notes_${uid}`, '1970-01-01T00:00:00.000Z');

    // Query only notes for current user updated after lastSyncTime (Spark plan optimization)
    const q = query(
      notesCol,
      where('userId', '==', uid),
      where('updatedAt', '>', lastSyncTime),
      limit(50)
    );

    const snapshot = await getDocs(q);
    if (snapshot.empty) return;

    let maxUpdated = lastSyncTime;
    let hasChanges = false;

    for (const docSnap of snapshot.docs) {
      const remoteData = docSnap.data();
      remoteData.$id = docSnap.id;
      const remoteNote = createNoteModel(remoteData);

      if (remoteNote.updatedAt > maxUpdated) {
        maxUpdated = remoteNote.updatedAt;
      }

      // Check if this was a recent local write by this device to avoid self-echoes
      const localWriteTime = this.recentLocalWrites.get(remoteNote.$id);
      if (localWriteTime && (Date.now() - localWriteTime) < 10000) {
        continue;
      }

      const localNote = await db.getNote(remoteNote.$id);
      const { resolvedNote, conflictCopy } = ConflictManager.resolve(localNote, remoteNote);

      if (conflictCopy) {
        await db.saveNote(conflictCopy);
        hasChanges = true;
      }

      if (
        !localNote ||
        localNote.updatedAt !== resolvedNote.updatedAt ||
        localNote.version !== resolvedNote.version
      ) {
        await db.saveNote(resolvedNote);
        hasChanges = true;
      }
    }

    await db.setSetting(`last_sync_notes_${uid}`, maxUpdated);

    if (hasChanges) {
      eventBus.emit('notes:changed', { action: 'firestore-pull' });
    }
  }

  /**
   * Delta sync for remote labels
   */
  async pullRemoteLabels() {
    const { collection, query, where, getDocs, limit } = firebase.SDK.firestore;
    const labelsCol = collection(firebase.firestore, 'labels');
    const uid = auth.getUserId();

    const q = query(labelsCol, where('userId', '==', uid), limit(50));
    const snapshot = await getDocs(q);

    let hasChanges = false;
    for (const docSnap of snapshot.docs) {
      const remoteLabel = createLabelModel({
        $id: docSnap.id,
        ...docSnap.data()
      });
      await db.saveLabel(remoteLabel);
      hasChanges = true;
    }

    if (hasChanges) {
      eventBus.emit('labels:changed');
    }
  }

  /**
   * Attach Firestore Realtime onSnapshot listener (only when logged in)
   */
  subscribeRealtime() {
    if (!firebase.isConfigured || !firebase.firestore) return;
    this.unsubscribeRealtime();

    const { collection, query, where, onSnapshot } = firebase.SDK.firestore;
    const uid = auth.getUserId();
    const q = query(collection(firebase.firestore, 'notes'), where('userId', '==', uid));

    try {
      this.realtimeUnsubscribe = onSnapshot(q, (snapshot) => {
        // Prevent sync loops: ignore pending local writes!
        if (snapshot.metadata.hasPendingWrites) {
          return;
        }

        snapshot.docChanges().forEach(async (change) => {
          const docData = change.doc.data();
          docData.$id = change.doc.id;

          if (change.type === 'added' || change.type === 'modified') {
            const remoteNote = createNoteModel(docData);
            const localNote = await db.getNote(remoteNote.$id);

            if (!localNote || localNote.updatedAt < remoteNote.updatedAt) {
              await db.saveNote(remoteNote);
              eventBus.emit('notes:changed', { action: 'realtime-update' });
            }
          } else if (change.type === 'removed') {
            await db.deleteNote(docData.$id);
            eventBus.emit('notes:changed', { action: 'realtime-delete' });
          }
        });
      }, (err) => {
        console.warn('[SyncEngine] Realtime Firestore arrêté :', err.message);
      });

      console.log('[SyncEngine] Écouteur temps réel Firestore actif.');
    } catch (err) {
      console.warn('[SyncEngine] Impossible d\'activer le temps réel Firestore :', err.message);
    }
  }

  unsubscribeRealtime() {
    if (this.realtimeUnsubscribe) {
      try {
        this.realtimeUnsubscribe();
      } catch (e) {}
      this.realtimeUnsubscribe = null;
    }
  }
}

export const syncEngine = new SyncEngine();
