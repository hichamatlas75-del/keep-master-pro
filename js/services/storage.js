/**
 * KEEP MASTER PRO - Storage Service
 * Handles file attachments, images, drawings, and voice audio blobs with offline queueing.
 */

import { appwrite } from './appwrite.js';
import { db } from '../database/indexeddb.js';
import { generateId, blobToDataURL } from '../utils/helpers.js';
import { APP_CONFIG } from '../config.js';

class StorageService {
  /**
   * Save an attachment locally and queue it for Appwrite upload
   */
  async saveAttachment(blob, filename, mimeType) {
    const localBlobId = 'blob_' + generateId();

    // 1. Convert to dataURL or store in IndexedDB media_blobs
    const dataURL = await blobToDataURL(blob);
    await db.saveBlob(localBlobId, dataURL, mimeType);

    const attachmentRecord = {
      id: generateId(),
      localBlobId,
      name: filename || `attachment-${Date.now()}`,
      type: mimeType,
      size: blob.size,
      url: dataURL, // Local preview immediately usable offline!
      remoteFileId: null,
      synced: false
    };

    // 2. If online and Appwrite Storage is ready, upload immediately
    if (navigator.onLine && appwrite.isConfigured && appwrite.storage) {
      try {
        const uploaded = await this.uploadToAppwrite(blob, filename, mimeType);
        if (uploaded) {
          attachmentRecord.remoteFileId = uploaded.$id;
          attachmentRecord.url = uploaded.url;
          attachmentRecord.synced = true;
        }
      } catch (err) {
        console.warn('[Storage] Téléversement différé en arrière-plan (mode hors-ligne):', err.message);
      }
    }

    return attachmentRecord;
  }

  /**
   * Upload file to Appwrite Storage
   */
  async uploadToAppwrite(blob, filename, mimeType) {
    if (!appwrite.isConfigured || !appwrite.storage) return null;

    const { ID } = appwrite.SDK;
    const bucketId = APP_CONFIG.APPWRITE.STORAGE_BUCKET_ID;
    const file = new File([blob], filename || 'file', { type: mimeType });

    try {
      const response = await appwrite.storage.createFile(bucketId, ID.unique(), file);
      const fileUrl = `${appwrite.endpoint}/storage/buckets/${bucketId}/files/${response.$id}/view?project=${appwrite.projectId}`;

      return {
        $id: response.$id,
        url: fileUrl
      };
    } catch (err) {
      console.error('[Storage] Erreur de téléversement vers Appwrite Storage :', err);
      throw err;
    }
  }

  /**
   * Delete attachment locally and remotely if synced
   */
  async deleteAttachment(attachment) {
    if (!attachment) return;

    if (attachment.localBlobId) {
      // Remove from IndexedDB blobs
      const rawDb = await db.getDB();
      const tx = rawDb.transaction([APP_CONFIG.STORES.MEDIA_BLOBS], 'readwrite');
      tx.objectStore(APP_CONFIG.STORES.MEDIA_BLOBS).delete(attachment.localBlobId);
    }

    if (attachment.remoteFileId && navigator.onLine && appwrite.isConfigured && appwrite.storage) {
      try {
        const bucketId = APP_CONFIG.APPWRITE.STORAGE_BUCKET_ID;
        await appwrite.storage.deleteFile(bucketId, attachment.remoteFileId);
      } catch (err) {
        console.warn('[Storage] Erreur suppression distante :', err);
      }
    }
  }
}

export const storage = new StorageService();
