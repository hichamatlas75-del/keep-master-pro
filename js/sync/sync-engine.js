/**
 * KEEP MASTER PRO - Bi-Directional Sync Engine
 * Realtime synchronization between IndexedDB and Appwrite Cloud.
 */

import { appwrite } from '../services/appwrite.js';
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
  }

  /**
   * Initialize sync engine and listeners
   */
  async init() {
    this.updateStatus();

    // Listen to browser network changes
    window.addEventListener('online', () => {
      console.log('[SyncEngine] Connexion réseau rétablie.');
      this.updateStatus();
      this.syncNow();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncEngine] Connexion réseau perdue. Passage en mode 100% hors-ligne.');
      this.setStatus(APP_CONFIG.SYNC_STATUS.OFFLINE, 'Hors ligne');
    });

    // Listen to manual sync trigger requests
    eventBus.on('sync:trigger', () => this.syncNow());

    // Listen to auth changes
    eventBus.on('auth:change', ({ isGuest }) => {
      if (!isGuest) {
        this.subscribeRealtime();
        this.syncNow();
      } else {
        this.unsubscribeRealtime();
      }
    });

    // Background periodic sync every 30 seconds if online
    this.syncInterval = setInterval(() => {
      if (navigator.onLine && !this.isSyncing && !auth.isGuest && appwrite.isConfigured) {
        this.syncNow();
      }
    }, 30000);

    // Initial sync
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

    if (auth.isGuest || !appwrite.isConfigured || !appwrite.databases) {
      this.setStatus(APP_CONFIG.SYNC_STATUS.ONLINE, 'Mode local');
      return;
    }

    this.isSyncing = true;
    this.setStatus(APP_CONFIG.SYNC_STATUS.SYNCING, 'Synchronisation...');

    try {
      // 1. Push pending local operations to Appwrite
      await this.processSyncQueue();

      // 2. Pull remote changes from Appwrite
      await this.pullRemoteNotes();
      await this.pullRemoteLabels();

      const pendingCount = await syncQueue.count();
      if (pendingCount > 0) {
        this.setStatus(APP_CONFIG.SYNC_STATUS.SYNCING, `${pendingCount} en attente`);
      } else {
        this.setStatus(APP_CONFIG.SYNC_STATUS.ONLINE, 'Synchronisé');
      }
    } catch (err) {
      console.warn('[SyncEngine] Avertissement lors de la synchronisation :', err.message);
      this.setStatus(APP_CONFIG.SYNC_STATUS.ONLINE, 'Mode hors-ligne actif');
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Process and push queued operations to Appwrite
   */
  async processSyncQueue() {
    const operations = await syncQueue.getPendingOperations(50);
    if (!operations || operations.length === 0) return;

    const dbId = APP_CONFIG.APPWRITE.DATABASE_ID;
    const notesColl = APP_CONFIG.APPWRITE.COLLECTIONS.NOTES;
    const labelsColl = APP_CONFIG.APPWRITE.COLLECTIONS.LABELS;

    for (const op of operations) {
      try {
        if (op.collection === 'notes') {
          if (op.action === 'CREATE') {
            await this.pushCreateNote(dbId, notesColl, op.data);
          } else if (op.action === 'UPDATE') {
            await this.pushUpdateNote(dbId, notesColl, op.documentId, op.data);
          } else if (op.action === 'DELETE') {
            await this.pushDeleteNote(dbId, notesColl, op.documentId);
          }
        } else if (op.collection === 'labels') {
          if (op.action === 'CREATE' || op.action === 'UPDATE') {
            await this.pushSaveLabel(dbId, labelsColl, op.data);
          } else if (op.action === 'DELETE') {
            await this.pushDeleteLabel(dbId, labelsColl, op.documentId);
          }
        }

        // Successfully synchronized: remove from queue
        await syncQueue.remove(op.id);
      } catch (err) {
        console.warn(`[SyncEngine] Erreur pour l'opération ${op.action} (${op.documentId}):`, err.message);
        // If document already exists on create or not found on delete, safely dequeue
        if (err.code === 409 || err.code === 404) {
          await syncQueue.remove(op.id);
        }
        break; // Stop loop and retry on next pass to preserve order
      }
    }
  }

  /**
   * Prepare note document for Appwrite TablesDB
   */
  formatNoteForAppwrite(note) {
    return {
      userId: auth.getUserId(),
      title: note.title || '',
      content: note.content || '',
      type: note.type || 'text',
      color: note.color || 'default',
      pinned: Boolean(note.pinned),
      archived: Boolean(note.archived),
      trashed: Boolean(note.trashed),
      checklist: JSON.stringify(note.checklist || []),
      labels: note.labels || [],
      reminder: JSON.stringify(note.reminder || null),
      attachments: JSON.stringify(note.attachments || []),
      version: Number(note.version) || 1,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
      deletedAt: note.deletedAt || null
    };
  }

  /**
   * Parse note document from Appwrite
   */
  parseNoteFromAppwrite(doc) {
    let checklist = [];
    let reminder = null;
    let attachments = [];

    try {
      checklist = typeof doc.checklist === 'string' ? JSON.parse(doc.checklist) : (doc.checklist || []);
    } catch (e) {}

    try {
      reminder = typeof doc.reminder === 'string' ? JSON.parse(doc.reminder) : (doc.reminder || null);
    } catch (e) {}

    try {
      attachments = typeof doc.attachments === 'string' ? JSON.parse(doc.attachments) : (doc.attachments || []);
    } catch (e) {}

    return createNoteModel({
      $id: doc.$id,
      userId: doc.userId,
      title: doc.title,
      content: doc.content,
      type: doc.type,
      color: doc.color,
      pinned: doc.pinned,
      archived: doc.archived,
      trashed: doc.trashed,
      checklist,
      labels: doc.labels || [],
      reminder,
      attachments,
      version: doc.version,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      deletedAt: doc.deletedAt
    });
  }

  async pushCreateNote(dbId, collId, note) {
    const formatted = this.formatNoteForAppwrite(note);
    await appwrite.databases.createDocument(dbId, collId, note.$id, formatted);
  }

  async pushUpdateNote(dbId, collId, docId, note) {
    const formatted = this.formatNoteForAppwrite(note);
    await appwrite.databases.updateDocument(dbId, collId, docId, formatted);
  }

  async pushDeleteNote(dbId, collId, docId) {
    await appwrite.databases.deleteDocument(dbId, collId, docId);
  }

  async pushSaveLabel(dbId, collId, label) {
    try {
      await appwrite.databases.createDocument(dbId, collId, label.$id, {
        userId: auth.getUserId(),
        name: label.name,
        color: label.color || 'default',
        createdAt: label.createdAt
      });
    } catch (err) {
      if (err.code === 409) {
        await appwrite.databases.updateDocument(dbId, collId, label.$id, {
          name: label.name,
          color: label.color || 'default'
        });
      } else {
        throw err;
      }
    }
  }

  async pushDeleteLabel(dbId, collId, docId) {
    await appwrite.databases.deleteDocument(dbId, collId, docId);
  }

  /**
   * Pull remote notes from Appwrite
   */
  async pullRemoteNotes() {
    const dbId = APP_CONFIG.APPWRITE.DATABASE_ID;
    const collId = APP_CONFIG.APPWRITE.COLLECTIONS.NOTES;
    const { Query } = appwrite.SDK;

    const response = await appwrite.databases.listDocuments(dbId, collId, [
      Query.equal('userId', auth.getUserId()),
      Query.limit(100)
    ]);

    let hasChanges = false;
    for (const doc of response.documents) {
      const remoteNote = this.parseNoteFromAppwrite(doc);
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

    if (hasChanges) {
      eventBus.emit('notes:changed', { action: 'pull' });
    }
  }

  /**
   * Pull remote labels from Appwrite
   */
  async pullRemoteLabels() {
    const dbId = APP_CONFIG.APPWRITE.DATABASE_ID;
    const collId = APP_CONFIG.APPWRITE.COLLECTIONS.LABELS;
    const { Query } = appwrite.SDK;

    const response = await appwrite.databases.listDocuments(dbId, collId, [
      Query.equal('userId', auth.getUserId()),
      Query.limit(100)
    ]);

    let hasChanges = false;
    for (const doc of response.documents) {
      const label = createLabelModel({
        $id: doc.$id,
        userId: doc.userId,
        name: doc.name,
        color: doc.color,
        createdAt: doc.createdAt
      });
      await db.saveLabel(label);
      hasChanges = true;
    }

    if (hasChanges) {
      eventBus.emit('labels:changed');
    }
  }

  /**
   * Appwrite Realtime Subscriptions
   */
  subscribeRealtime() {
    if (!appwrite.isConfigured || !appwrite.client) return;
    this.unsubscribeRealtime();

    const dbId = APP_CONFIG.APPWRITE.DATABASE_ID;
    const notesColl = APP_CONFIG.APPWRITE.COLLECTIONS.NOTES;
    const channel = `databases.${dbId}.collections.${notesColl}.documents`;

    try {
      this.realtimeUnsubscribe = appwrite.client.subscribe(channel, (response) => {
        const event = response.events[0];
        const payload = response.payload;

        if (event.includes('.create') || event.includes('.update')) {
          const remoteNote = this.parseNoteFromAppwrite(payload);
          db.saveNote(remoteNote).then(() => {
            eventBus.emit('notes:changed', { action: 'realtime-update' });
          });
        } else if (event.includes('.delete')) {
          db.deleteNote(payload.$id).then(() => {
            eventBus.emit('notes:changed', { action: 'realtime-delete' });
          });
        }
      });
      console.log('[SyncEngine] Abonnement Realtime Appwrite actif.');
    } catch (err) {
      console.warn('[SyncEngine] Realtime non disponible :', err.message);
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
