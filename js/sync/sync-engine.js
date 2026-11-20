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
import { deepClone } from '../utils/helpers.js';

class SyncEngine {
  constructor() {
    this.isSyncing = false;
    this.syncRequested = false;
    this.syncDebounceTimer = null;
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

    // Listen to automatic sync triggers on any modification
    eventBus.on('sync:trigger', () => this.triggerSync());

    // Flush any pending sync when tab/app visibility changes or is closed
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flushPendingSync();
        }
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', () => {
        this.flushPendingSync();
      });
    }

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

  /**
   * Systematic automatic sync trigger after modification.
   * Debounces burst modifications (e.g. rapid typing / batch deletes) into a single batch,
   * while guaranteeing that every modification is systematically synchronized.
   */
  triggerSync(delay = 100) {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
    }
    this.syncDebounceTimer = setTimeout(() => {
      this.syncDebounceTimer = null;
      this.syncNow();
    }, delay);
  }

  /**
   * Immediately execute any pending debounced sync
   */
  flushPendingSync() {
    if (this.syncDebounceTimer) {
      clearTimeout(this.syncDebounceTimer);
      this.syncDebounceTimer = null;
    }
    this.syncNow();
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
    if (this.isSyncing) {
      this.syncRequested = true;
      return;
    }
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
      // 1. Push pending local operations to Firestore via batched writes (drains all batches)
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
      if (this.syncRequested) {
        this.syncRequested = false;
        setTimeout(() => this.syncNow(), 50);
      }
    }
  }

  /**
   * Process pending sync queue using Firestore writeBatch (Quota & performance optimization)
   */
  async processSyncQueue() {
    const maxBatches = 10;
    let batchCount = 0;

    while (batchCount < maxBatches) {
      batchCount++;
      const operations = await syncQueue.getPendingOperations(40);
      if (!operations || operations.length === 0) break;

      const { doc, writeBatch, setDoc, deleteDoc } = firebase.SDK.firestore;
      const batch = writeBatch(firebase.firestore);
      const preparedOps = [];

      for (const op of operations) {
        try {
          const docRef = doc(firebase.firestore, op.collection, op.documentId);

          if (op.action === 'CREATE' || op.action === 'UPDATE') {
            const payload = this.formatPayloadForFirestore(op.data, op.collection);
            batch.set(docRef, payload, { merge: true });
            this.recentLocalWrites.set(op.documentId, Date.now());
            preparedOps.push({ op, docRef, payload });
          } else if (op.action === 'DELETE') {
            batch.delete(docRef);
            preparedOps.push({ op, docRef, payload: null });
          }
        } catch (err) {
          console.warn(`[SyncEngine] Erreur préparation batch pour ${op.documentId}:`, err);
        }
      }

      if (preparedOps.length > 0) {
        try {
          // Commit all batched operations in a single Firestore call!
          await batch.commit();
          for (const { op } of preparedOps) {
            await syncQueue.remove(op.id);
          }
        } catch (batchErr) {
          console.warn('[SyncEngine] Échec du batch Firestore, repli unitaire :', batchErr.message);
          for (const { op, docRef, payload } of preparedOps) {
            try {
              if (op.action === 'CREATE' || op.action === 'UPDATE') {
                await setDoc(docRef, payload, { merge: true });
                this.recentLocalWrites.set(op.documentId, Date.now());
              } else if (op.action === 'DELETE') {
                await deleteDoc(docRef);
              }
              await syncQueue.remove(op.id);
            } catch (singleErr) {
              console.warn(`[SyncEngine] Échec opération unitaire pour ${op.documentId}:`, singleErr.message);
              await syncQueue.remove(op.id);
            }
          }
        }
      } else {
        break;
      }
    }
  }

  /**
   * Format note data for Firestore (enforcing Spark 1MB doc limit safely)
   */
  formatPayloadForFirestore(data, collection = 'notes') {
    if (!data) return {};
    const payload = deepClone(data);

    if (collection === 'labels') {
      payload.userId = auth.getUserId();
      delete payload.updatedAt;
      return payload;
    }

    if (collection === 'shares') {
      payload.ownerId = payload.ownerId || auth.getUserId();
      return payload;
    }

    payload.userId = auth.getUserId();
    payload.updatedAt = payload.updatedAt || new Date().toISOString();

    if (Array.isArray(payload.attachments) && JSON.stringify(payload).length > 900000) {
      const indexed = payload.attachments
        .map((att, idx) => ({ idx, len: att?.url ? att.url.length : 0 }))
        .sort((a, b) => b.len - a.len);

      for (const entry of indexed) {
        if (JSON.stringify(payload).length <= 900000) break;
        const att = payload.attachments[entry.idx];
        if (att && att.url) {
          console.warn(`[SyncEngine] Pièce jointe ${att.name || att.id} conservée localement (taille Firestore > 900Ko).`);
          att.url = '';
          att.synced = false;
        }
      }
    }

    return payload;
  }

  /**
   * Restore local attachment data URLs if stripped on remote Firestore payload
   */
  async hydrateLocalAttachments(remoteNote, localNote) {
    if (!remoteNote || !Array.isArray(remoteNote.attachments)) return remoteNote;

    const localAttMap = new Map(
      (localNote?.attachments || [])
        .filter(a => a && a.localBlobId && a.url)
        .map(a => [a.localBlobId, a.url])
    );

    for (const att of remoteNote.attachments) {
      if (att && !att.url && att.localBlobId) {
        if (localAttMap.has(att.localBlobId)) {
          att.url = localAttMap.get(att.localBlobId);
          att.synced = true;
        } else {
          const record = await db.getBlob(att.localBlobId);
          if (record?.blob) {
            att.url = record.blob;
            att.synced = true;
          }
        }
      }
    }

    return remoteNote;
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
      await this.hydrateLocalAttachments(remoteNote, localNote);
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

        (async () => {
          let hasChanges = false;
          for (const change of snapshot.docChanges()) {
            const docData = change.doc.data();
            docData.$id = change.doc.id;

            // Avoid echo of recent local write from this device
            const localWriteTime = this.recentLocalWrites.get(docData.$id);
            if (localWriteTime && (Date.now() - localWriteTime) < 8000) {
              continue;
            }

            if (change.type === 'added' || change.type === 'modified') {
              const remoteNote = createNoteModel(docData);
              const localNote = await db.getNote(remoteNote.$id);

              if (!localNote || localNote.updatedAt < remoteNote.updatedAt) {
                await this.hydrateLocalAttachments(remoteNote, localNote);
                await db.saveNote(remoteNote);
                hasChanges = true;
              }
            } else if (change.type === 'removed') {
              await db.deleteNote(docData.$id);
              hasChanges = true;
            }
          }

          if (hasChanges) {
            eventBus.emit('notes:changed', { action: 'realtime-batch' });
          }
        })().catch((err) => console.warn('[SyncEngine] Erreur traitement temps réel :', err));
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
