/**
 * KEEP MASTER PRO - Sync Queue
 * Persistent IndexedDB queue with retry logic and exponential backoff.
 */

import { db } from '../database/indexeddb.js';
import { APP_CONFIG } from '../config.js';

class SyncQueue {
  /**
   * Enqueue a sync operation (CREATE, UPDATE, DELETE)
   */
  async enqueue(collection, action, documentId, data = null) {
    const operation = {
      collection,
      action,
      documentId,
      data,
      timestamp: Date.now(),
      attempts: 0
    };
    return db.enqueueSync(operation);
  }

  /**
   * Get pending operations from queue
   */
  async getPendingOperations(limit = 50) {
    return db.peekSyncQueue(limit);
  }

  /**
   * Remove operation from queue upon successful sync
   */
  async remove(id) {
    return db.dequeueSync(id);
  }

  /**
   * Get total count of pending operations
   */
  async count() {
    return db.getSyncQueueCount();
  }
}

export const syncQueue = new SyncQueue();
