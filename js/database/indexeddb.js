/**
 * KEEP MASTER PRO - IndexedDB Local Database
 * Offline-first persistent storage engine.
 */

import { APP_CONFIG } from '../config.js';
import { createNoteModel, createLabelModel } from './schema.js';

class IndexedDBDatabase {
  constructor() {
    this.db = null;
    this.dbPromise = null;
  }

  /**
   * Open / initialize IndexedDB
   */
  async init() {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(APP_CONFIG.DB_NAME, APP_CONFIG.DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Notes Store
        if (!db.objectStoreNames.contains(APP_CONFIG.STORES.NOTES)) {
          const notesStore = db.createObjectStore(APP_CONFIG.STORES.NOTES, { keyPath: '$id' });
          notesStore.createIndex('userId', 'userId', { unique: false });
          notesStore.createIndex('updatedAt', 'updatedAt', { unique: false });
          notesStore.createIndex('pinned', 'pinned', { unique: false });
          notesStore.createIndex('archived', 'archived', { unique: false });
          notesStore.createIndex('trashed', 'trashed', { unique: false });
        }

        // Labels Store
        if (!db.objectStoreNames.contains(APP_CONFIG.STORES.LABELS)) {
          const labelsStore = db.createObjectStore(APP_CONFIG.STORES.LABELS, { keyPath: '$id' });
          labelsStore.createIndex('userId', 'userId', { unique: false });
          labelsStore.createIndex('name', 'name', { unique: false });
        }

        // Reminders Store
        if (!db.objectStoreNames.contains(APP_CONFIG.STORES.REMINDERS)) {
          const remindersStore = db.createObjectStore(APP_CONFIG.STORES.REMINDERS, { keyPath: '$id' });
          remindersStore.createIndex('noteId', 'noteId', { unique: false });
          remindersStore.createIndex('date', 'date', { unique: false });
        }

        // Shares Store
        if (!db.objectStoreNames.contains(APP_CONFIG.STORES.SHARES)) {
          const sharesStore = db.createObjectStore(APP_CONFIG.STORES.SHARES, { keyPath: '$id' });
          sharesStore.createIndex('noteId', 'noteId', { unique: false });
        }

        // Sync Queue Store
        if (!db.objectStoreNames.contains(APP_CONFIG.STORES.SYNC_QUEUE)) {
          const syncStore = db.createObjectStore(APP_CONFIG.STORES.SYNC_QUEUE, { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('timestamp', 'timestamp', { unique: false });
          syncStore.createIndex('collection', 'collection', { unique: false });
        }

        // Settings Store (key-value)
        if (!db.objectStoreNames.contains(APP_CONFIG.STORES.SETTINGS)) {
          db.createObjectStore(APP_CONFIG.STORES.SETTINGS, { keyPath: 'key' });
        }

        // Media Blobs Store (for offline images, drawings, and voice notes)
        if (!db.objectStoreNames.contains(APP_CONFIG.STORES.MEDIA_BLOBS)) {
          db.createObjectStore(APP_CONFIG.STORES.MEDIA_BLOBS, { keyPath: 'id' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] Erreur d\'ouverture de la base de données :', event.target.error);
        reject(event.target.error);
      };
    });

    return this.dbPromise;
  }

  async getDB() {
    if (!this.db) {
      await this.init();
    }
    return this.db;
  }

  // ===================================================================
  // NOTES CRUD
  // ===================================================================
  async saveNote(note) {
    const db = await this.getDB();
    const cleanNote = createNoteModel(note);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.NOTES], 'readwrite');
      const store = tx.objectStore(APP_CONFIG.STORES.NOTES);
      const req = store.put(cleanNote);

      req.onsuccess = () => resolve(cleanNote);
      req.onerror = () => reject(req.error);
    });
  }

  async getNote(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.NOTES], 'readonly');
      const store = tx.objectStore(APP_CONFIG.STORES.NOTES);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async getAllNotes() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.NOTES], 'readonly');
      const store = tx.objectStore(APP_CONFIG.STORES.NOTES);
      const req = store.getAll();

      req.onsuccess = () => {
        const notes = req.result || [];
        // Sort descending by updatedAt
        notes.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        resolve(notes);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteNote(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.NOTES], 'readwrite');
      const store = tx.objectStore(APP_CONFIG.STORES.NOTES);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ===================================================================
  // LABELS CRUD
  // ===================================================================
  async saveLabel(label) {
    const db = await this.getDB();
    const cleanLabel = createLabelModel(label);

    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.LABELS], 'readwrite');
      const store = tx.objectStore(APP_CONFIG.STORES.LABELS);
      const req = store.put(cleanLabel);

      req.onsuccess = () => resolve(cleanLabel);
      req.onerror = () => reject(req.error);
    });
  }

  async getLabels() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.LABELS], 'readonly');
      const store = tx.objectStore(APP_CONFIG.STORES.LABELS);
      const req = store.getAll();

      req.onsuccess = () => {
        const labels = req.result || [];
        labels.sort((a, b) => a.name.localeCompare(b.name));
        resolve(labels);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async deleteLabel(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.LABELS], 'readwrite');
      const store = tx.objectStore(APP_CONFIG.STORES.LABELS);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  // ===================================================================
  // SETTINGS (Key-Value)
  // ===================================================================
  async getSetting(key, defaultValue = null) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.SETTINGS], 'readonly');
      const store = tx.objectStore(APP_CONFIG.STORES.SETTINGS);
      const req = store.get(key);

      req.onsuccess = () => {
        resolve(req.result ? req.result.value : defaultValue);
      };
      req.onerror = () => reject(req.error);
    });
  }

  async setSetting(key, value) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.SETTINGS], 'readwrite');
      const store = tx.objectStore(APP_CONFIG.STORES.SETTINGS);
      const req = store.put({ key, value });

      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  }

  // ===================================================================
  // SYNC QUEUE OPERATIONS
  // ===================================================================
  async enqueueSync(operation) {
    const db = await this.getDB();
    const entry = {
      collection: operation.collection,
      action: operation.action, // 'CREATE' | 'UPDATE' | 'DELETE'
      documentId: operation.documentId,
      data: operation.data || null,
      timestamp: Date.now(),
      attempts: 0
    };

    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.SYNC_QUEUE], 'readwrite');
      const store = tx.objectStore(APP_CONFIG.STORES.SYNC_QUEUE);
      const req = store.add(entry);

      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  async peekSyncQueue(limit = 50) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.SYNC_QUEUE], 'readonly');
      const store = tx.objectStore(APP_CONFIG.STORES.SYNC_QUEUE);
      const req = store.getAll(null, limit);

      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  async dequeueSync(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.SYNC_QUEUE], 'readwrite');
      const store = tx.objectStore(APP_CONFIG.STORES.SYNC_QUEUE);
      const req = store.delete(id);

      req.onsuccess = () => resolve(true);
      req.onerror = () => reject(req.error);
    });
  }

  async getSyncQueueCount() {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.SYNC_QUEUE], 'readonly');
      const store = tx.objectStore(APP_CONFIG.STORES.SYNC_QUEUE);
      const req = store.count();

      req.onsuccess = () => resolve(req.result || 0);
      req.onerror = () => reject(req.error);
    });
  }

  // ===================================================================
  // MEDIA BLOBS STORE (Offline files & local attachments)
  // ===================================================================
  async saveBlob(id, blob, mimeType = 'image/png') {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.MEDIA_BLOBS], 'readwrite');
      const store = tx.objectStore(APP_CONFIG.STORES.MEDIA_BLOBS);
      const req = store.put({ id, blob, mimeType, createdAt: Date.now() });

      req.onsuccess = () => resolve(id);
      req.onerror = () => reject(req.error);
    });
  }

  async getBlob(id) {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([APP_CONFIG.STORES.MEDIA_BLOBS], 'readonly');
      const store = tx.objectStore(APP_CONFIG.STORES.MEDIA_BLOBS);
      const req = store.get(id);

      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  // ===================================================================
  // BACKUP & RESET
  // ===================================================================
  async clearAll() {
    const db = await this.getDB();
    const storeNames = [
      APP_CONFIG.STORES.NOTES,
      APP_CONFIG.STORES.LABELS,
      APP_CONFIG.STORES.REMINDERS,
      APP_CONFIG.STORES.SHARES,
      APP_CONFIG.STORES.SYNC_QUEUE,
      APP_CONFIG.STORES.MEDIA_BLOBS
    ];

    const tx = db.transaction(storeNames, 'readwrite');
    for (const name of storeNames) {
      tx.objectStore(name).clear();
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error);
    });
  }
}

export const db = new IndexedDBDatabase();
