/**
 * KEEP MASTER PRO - Archive Module
 * Archive and restore notes without deletion.
 */

import { NotesModule } from './notes.js';
import { db } from '../database/indexeddb.js';

export class ArchiveModule {
  /**
   * Archive note
   */
  static async archiveNote(noteId) {
    return NotesModule.updateNote(noteId, {
      archived: true,
      pinned: false
    });
  }

  /**
   * Restore archived note to main view
   */
  static async unarchiveNote(noteId) {
    return NotesModule.updateNote(noteId, {
      archived: false
    });
  }

  /**
   * Get all active archived notes
   */
  static async getArchivedNotes() {
    const notes = await db.getAllNotes();
    return notes.filter(n => n.archived && !n.trashed);
  }
}
