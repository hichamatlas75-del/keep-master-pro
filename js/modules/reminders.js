/**
 * KEEP MASTER PRO - Reminders Module
 * Date/time reminders, recurring reminder options, and background scheduling.
 */

import { NotesModule } from './notes.js';
import { db } from '../database/indexeddb.js';
import { notifications } from '../utils/notifications.js';

export class RemindersModule {
  static _watcherInterval = null;

  /**
   * Set reminder on a note
   */
  static async setReminder(noteId, isoDateTime, repeat = 'none') {
    // Proactively request notification permission when setting a reminder
    if (typeof window !== 'undefined') {
      notifications.requestPermission().catch(() => {});
    }

    return NotesModule.updateNote(noteId, {
      reminder: {
        date: isoDateTime,
        repeat, // 'none' | 'daily' | 'weekly'
        completed: false
      }
    });
  }

  /**
   * Remove reminder from note
   */
  static async clearReminder(noteId) {
    return NotesModule.updateNote(noteId, { reminder: null });
  }

  /**
   * Mark reminder as completed
   */
  static async toggleCompleted(noteId) {
    const note = await db.getNote(noteId);
    if (!note || !note.reminder) return;

    const completed = !note.reminder.completed;
    return NotesModule.updateNote(noteId, {
      reminder: {
        ...note.reminder,
        completed
      }
    });
  }

  /**
   * Check all pending reminders upon app startup or window focus
   */
  static async checkPendingReminders() {
    const notes = await db.getAllNotes();
    const now = new Date();

    for (const note of notes) {
      if (
        !note.trashed &&
        note.reminder &&
        note.reminder.date &&
        !note.reminder.completed
      ) {
        const reminderTime = new Date(note.reminder.date).getTime();
        if (reminderTime <= now.getTime()) {
          // Trigger missed notification
          await notifications.triggerReminder(note);
        } else {
          // Schedule future notification
          notifications.scheduleReminder(note);
        }
      }
    }
  }

  /**
   * Periodic reminder watcher to ensure reminders fire even across long background sessions
   */
  static startReminderWatcher(intervalMs = 45000) {
    if (this._watcherInterval) clearInterval(this._watcherInterval);
    this._watcherInterval = setInterval(() => {
      this.checkPendingReminders();
    }, intervalMs);
  }
}
