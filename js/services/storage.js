/**
 * KEEP MASTER PRO - Storage Service
 * Local-First media & attachment management (IndexedDB Blobs & DataURLs)
 * Compatible with Spark Free Plan without requiring paid Firebase Storage.
 */

import { db } from '../database/indexeddb.js';
import { generateId, blobToDataURL } from '../utils/helpers.js';
import { APP_CONFIG } from '../config.js';

class StorageService {
  /**
   * Save an attachment locally in IndexedDB media_blobs
   */
  async saveAttachment(blob, filename, mimeType) {
    const localBlobId = 'blob_' + generateId();

    // 1. Convert to dataURL and store in IndexedDB media_blobs
    const dataURL = await blobToDataURL(blob);
    await db.saveBlob(localBlobId, dataURL, mimeType);

    const attachmentRecord = {
      id: generateId(),
      localBlobId,
      name: filename || `attachment-${Date.now()}`,
      type: mimeType,
      size: blob.size,
      url: dataURL, // Immediately available offline and included in JSON backups
      remoteFileId: null,
      synced: true // Local-first is self-contained
    };

    return attachmentRecord;
  }

  /**
   * Retrieve attachment blob / dataURL from local store
   */
  async getAttachment(localBlobId) {
    return db.getBlob(localBlobId);
  }

  /**
   * Delete attachment locally
   */
  async deleteAttachment(attachment) {
    if (!attachment || !attachment.localBlobId) return;

    try {
      const rawDb = await db.getDB();
      const tx = rawDb.transaction([APP_CONFIG.STORES.MEDIA_BLOBS], 'readwrite');
      tx.objectStore(APP_CONFIG.STORES.MEDIA_BLOBS).delete(attachment.localBlobId);
    } catch (err) {
      console.warn('[Storage] Erreur suppression blob local :', err);
    }
  }
}

export const storage = new StorageService();
