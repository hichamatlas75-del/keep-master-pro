/**
 * KEEP MASTER PRO - Storage Service
 * Local-First media & attachment management (IndexedDB Blobs & DataURLs)
 * Compatible with Spark Free Plan without requiring paid Firebase Storage.
 */

import { db } from '../database/indexeddb.js';
import { generateId, blobToDataURL, compressImage } from '../utils/helpers.js';
import { APP_CONFIG } from '../config.js';

class StorageService {
  /**
   * Save an attachment locally in IndexedDB media_blobs
   */
  async saveAttachment(blob, filename, mimeType, extraMeta = {}) {
    if (!blob || !(blob instanceof Blob) || blob.size === 0) {
      throw new Error('Fichier média vide ou invalide.');
    }

    const localBlobId = 'blob_' + generateId();

    // 1. Optimize images if needed to stay within safe storage/quota limits
    let finalBlob = blob;
    let finalMime = mimeType || blob.type || 'application/octet-stream';

    if (finalMime.startsWith('image/')) {
      try {
        finalBlob = await compressImage(blob);
        finalMime = finalBlob.type || finalMime;
      } catch (e) {
        console.warn('[Storage] Compression d\'image ignorée :', e);
      }
    }

    // 2. Convert to dataURL and store in IndexedDB media_blobs
    const dataURL = await blobToDataURL(finalBlob);
    try {
      await db.saveBlob(localBlobId, dataURL, finalMime);
    } catch (err) {
      if (err && err.name === 'QuotaExceededError') {
        throw new Error('Espace de stockage local insuffisant pour enregistrer ce fichier.');
      }
      throw err;
    }

    const attachmentRecord = {
      id: generateId(),
      localBlobId,
      name: filename || `attachment-${Date.now()}`,
      type: finalMime,
      size: finalBlob.size,
      url: dataURL, // Immediately available offline and included in JSON backups
      remoteFileId: null,
      synced: true, // Local-first is self-contained
      ...extraMeta
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
