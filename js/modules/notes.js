/**
 * KEEP MASTER PRO - Notes Core Module
 * Create, edit, pin, duplicate, color change, delete, and auto-save.
 */

import { db } from '../database/indexeddb.js';
import { auth } from '../services/auth.js';
import { syncQueue } from '../sync/sync-queue.js';
import { createNoteModel } from '../database/schema.js';
import { generateId, deepClone } from '../utils/helpers.js';
import { eventBus } from '../utils/event-bus.js';
import { notifications } from '../utils/notifications.js';

export class NotesModule {
  /**
   * Create a new note
   */
  static async createNote(data) {
    const uid = auth.getUserId();
    const note = createNoteModel({
      ...data,
      userId: (data.userId && data.userId !== 'guest') ? data.userId : (uid && uid !== 'guest' ? uid : 'guest'),
      $id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    });

    // 1. Save locally to IndexedDB immediately
    await db.saveNote(note);

    // 2. Queue for remote sync
    await syncQueue.enqueue('notes', 'CREATE', note.$id, note);

    // 3. Schedule notification if reminder attached
    if (note.reminder) {
      notifications.scheduleReminder(note);
    }

    // 4. Emit event
    eventBus.emit('notes:changed', { action: 'create', note });
    eventBus.emit('sync:trigger');

    return note;
  }

  /**
   * Update an existing note
   */
  static async updateNote(noteId, updates) {
    const existing = await db.getNote(noteId);
    if (!existing) {
      throw new Error(`Note ${noteId} introuvable.`);
    }

    const uid = auth.getUserId();
    const updated = createNoteModel({
      ...existing,
      ...updates,
      userId: (existing.userId && existing.userId !== 'guest') ? existing.userId : (uid && uid !== 'guest' ? uid : 'guest'),
      version: (Number(existing.version) || 1) + 1,
      updatedAt: new Date().toISOString()
    });

    // 1. Save locally
    await db.saveNote(updated);

    // 2. Queue sync operation
    await syncQueue.enqueue('notes', 'UPDATE', updated.$id, updated);

    // 3. Update reminder if changed
    if (updated.reminder) {
      notifications.scheduleReminder(updated);
    } else {
      notifications.cancelReminder(updated.$id);
    }

    // 4. Emit event
    eventBus.emit('notes:changed', { action: 'update', note: updated });
    eventBus.emit('sync:trigger');

    return updated;
  }

  /**
   * Toggle pinned state
   */
  static async togglePin(noteId) {
    const note = await db.getNote(noteId);
    if (!note) return;
    return this.updateNote(noteId, { pinned: !note.pinned });
  }

  /**
   * Change note color (one of 10 colors)
   */
  static async setColor(noteId, color) {
    return this.updateNote(noteId, { color });
  }

  /**
   * Duplicate a note
   */
  static async duplicateNote(noteId) {
    const note = await db.getNote(noteId);
    if (!note) return;

    const clonedData = deepClone(note);
    delete clonedData.$id;
    clonedData.title = `${clonedData.title || 'Note'} (Copie)`;
    clonedData.pinned = false;

    return this.createNote(clonedData);
  }

  /**
   * Soft delete (move to trash)
   */
  static async moveToTrash(noteId) {
    notifications.cancelReminder(noteId);
    return this.updateNote(noteId, {
      trashed: true,
      pinned: false,
      deletedAt: new Date().toISOString()
    });
  }

  /**
   * Restore from trash
   */
  static async restoreFromTrash(noteId) {
    return this.updateNote(noteId, {
      trashed: false,
      deletedAt: null
    });
  }

  /**
   * Permanent delete
   */
  static async deletePermanently(noteId) {
    notifications.cancelReminder(noteId);
    await db.deleteNote(noteId);
    await syncQueue.enqueue('notes', 'DELETE', noteId);
    eventBus.emit('notes:changed', { action: 'delete-permanent', noteId });
    eventBus.emit('sync:trigger');
  }

  /**
   * Toggle archive state
   */
  static async toggleArchive(noteId) {
    const note = await db.getNote(noteId);
    if (!note) return;
    return this.updateNote(noteId, {
      archived: !note.archived,
      pinned: false
    });
  }
}
