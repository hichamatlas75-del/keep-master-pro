/**
 * KEEP MASTER PRO - Trash Module
 * Move to trash, restore notes, and permanently empty trash.
 */

import { NotesModule } from './notes.js';
import { db } from '../database/indexeddb.js';

export class TrashModule {
  /**
   * Move note to trash
   */
  static async moveToTrash(noteId) {
    return NotesModule.moveToTrash(noteId);
  }

  /**
   * Restore note from trash
   */
  static async restoreNote(noteId) {
    return NotesModule.restoreFromTrash(noteId);
  }

  /**
   * Permanently delete a note
   */
  static async deletePermanently(noteId) {
    return NotesModule.deletePermanently(noteId);
  }

  /**
   * Empty entire trash
   */
  static async emptyTrash() {
    const notes = await db.getAllNotes();
    const trashedNotes = notes.filter(n => n.trashed);

    for (const note of trashedNotes) {
      await NotesModule.deletePermanently(note.$id);
    }

    return trashedNotes.length;
  }

  /**
   * Get all trashed notes
   */
  static async getTrashedNotes() {
    const notes = await db.getAllNotes();
    return notes.filter(n => n.trashed);
  }
}
