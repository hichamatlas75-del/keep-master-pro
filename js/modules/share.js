/**
 * KEEP MASTER PRO - Sharing & Collaboration Module
 * Web Share API, clipboard fallback, and Firebase/Firestore permissions sharing.
 */

import { auth } from '../services/auth.js';
import { db } from '../database/indexeddb.js';
import { syncQueue } from '../sync/sync-queue.js';
import { createShareModel } from '../database/schema.js';
import { APP_CONFIG } from '../config.js';
import { eventBus } from '../utils/event-bus.js';

export class ShareModule {
  /**
   * Share note content via native Web Share API or Clipboard fallback
   */
  static async shareNative(note) {
    if (!note) return false;

    let checklistText = '';
    if (note.type === 'checklist' && Array.isArray(note.checklist)) {
      checklistText = '\n' + note.checklist
        .map(i => `${i.completed ? '☑' : '☐'} ${i.text}`)
        .join('\n');
    }

    const shareData = {
      title: note.title || 'Note Keep Master',
      text: (note.content || '') + checklistText,
      url: window.location.origin + window.location.pathname + `?note=${note.$id}`
    };

    if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        return { method: 'native' };
      } catch (err) {
        if (err.name === 'AbortError') return { method: 'aborted' };
      }
    }

    // Fallback: copy formatted text to clipboard
    try {
      const fullText = `${shareData.title}\n\n${shareData.text}\n\n${shareData.url}`;
      await navigator.clipboard.writeText(fullText);
      return { method: 'clipboard' };
    } catch (e) {
      return { method: 'failed' };
    }
  }

  /**
   * Format note title, content, checklist and attachments text for copying or export
   */
  static formatNoteForCopy(note) {
    if (!note) return '';
    const parts = [];

    if (note.title && note.title.trim()) {
      parts.push(note.title.trim());
    }

    if (note.content && note.content.trim()) {
      parts.push(note.content.trim());
    }

    if (note.type === 'checklist' && Array.isArray(note.checklist) && note.checklist.length > 0) {
      const items = note.checklist
        .filter(i => i && i.text && i.text.trim())
        .map(i => `${i.completed ? '☑' : '☐'} ${i.text.trim()}`);
      if (items.length > 0) {
        parts.push(items.join('\n'));
      }
    }

    if (Array.isArray(note.attachments)) {
      const ocrParts = note.attachments
        .filter(att => att && att.extractedText && (!note.content || !note.content.includes(att.extractedText)))
        .map(att => `[Texte extrait (${att.name || 'Image'})] :\n${att.extractedText.trim()}`);
      if (ocrParts.length > 0) {
        parts.push(ocrParts.join('\n\n'));
      }
    }

    return parts.join('\n\n');
  }

  /**
   * Copy formatted note directly to the system clipboard
   */
  static async copyNote(note) {
    const text = this.formatNoteForCopy(note);
    if (!text) {
      throw new Error('La note est vide.');
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return text;
    }

    // Fallback for document copy execCommand
    if (typeof document !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
      return text;
    }

    return text;
  }

  /**
   * Create a collaboration share record
   */
  static async shareWithUser(noteId, targetUserIdOrEmail, permission = 'read') {
    const share = createShareModel({
      noteId,
      ownerId: auth.getUserId(),
      sharedWith: targetUserIdOrEmail,
      permission
    });

    // Save to local IndexedDB shares store
    const rawDb = await db.getDB();
    const tx = rawDb.transaction([APP_CONFIG.STORES.SHARES], 'readwrite');
    tx.objectStore(APP_CONFIG.STORES.SHARES).put(share);

    // Queue for Cloud Firestore sync
    await syncQueue.enqueue('shares', 'CREATE', share.$id, share);
    eventBus.emit('sync:trigger');

    return share;
  }
}
