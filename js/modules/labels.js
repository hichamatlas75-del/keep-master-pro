/**
 * KEEP MASTER PRO - Labels Module
 * Label CRUD, multi-label assignment to notes, and label cascade updates.
 */

import { db } from '../database/indexeddb.js';
import { syncQueue } from '../sync/sync-queue.js';
import { createLabelModel } from '../database/schema.js';
import { sanitizeText } from '../utils/sanitize.js';
import { eventBus } from '../utils/event-bus.js';

export class LabelsModule {
  /**
   * Create a new label
   */
  static async createLabel(name, color = 'default') {
    const cleanName = sanitizeText(name);
    if (!cleanName) {
      throw new Error('Le nom du libellé ne peut pas être vide.');
    }

    // Check if label with same name exists
    const existing = await db.getLabels();
    if (existing.some(l => l.name.toLowerCase() === cleanName.toLowerCase())) {
      throw new Error(`Le libellé "${cleanName}" existe déjà.`);
    }

    const label = createLabelModel({ name: cleanName, color });
    await db.saveLabel(label);
    await syncQueue.enqueue('labels', 'CREATE', label.$id, label);

    eventBus.emit('labels:changed');
    eventBus.emit('sync:trigger');
    return label;
  }

  /**
   * Rename or update label
   */
  static async updateLabel(id, name, color) {
    const cleanName = sanitizeText(name);
    if (!cleanName) throw new Error('Le nom ne peut pas être vide.');

    const label = createLabelModel({
      $id: id,
      name: cleanName,
      color: color || 'default'
    });

    await db.saveLabel(label);
    await syncQueue.enqueue('labels', 'UPDATE', id, label);

    eventBus.emit('labels:changed');
    eventBus.emit('sync:trigger');
    return label;
  }

  /**
   * Delete label and remove from all notes
   */
  static async deleteLabel(id) {
    await db.deleteLabel(id);
    await syncQueue.enqueue('labels', 'DELETE', id);

    // Cascade: remove label reference from existing notes
    const notes = await db.getAllNotes();
    for (const note of notes) {
      if (Array.isArray(note.labels) && note.labels.includes(id)) {
        note.labels = note.labels.filter(lblId => lblId !== id);
        await db.saveNote(note);
        await syncQueue.enqueue('notes', 'UPDATE', note.$id, note);
      }
    }

    eventBus.emit('labels:changed');
    eventBus.emit('notes:changed', { action: 'label-deleted' });
    eventBus.emit('sync:trigger');
  }

  /**
   * Attach label to note
   */
  static async attachLabelToNote(note, labelId) {
    if (!note.labels) note.labels = [];
    if (!note.labels.includes(labelId)) {
      note.labels.push(labelId);
      note.updatedAt = new Date().toISOString();
      await db.saveNote(note);
      await syncQueue.enqueue('notes', 'UPDATE', note.$id, note);
      eventBus.emit('notes:changed', { action: 'label-attached', note });
      eventBus.emit('sync:trigger');
    }
    return note;
  }

  /**
   * Detach label from note
   */
  static async detachLabelFromNote(note, labelId) {
    if (note.labels && note.labels.includes(labelId)) {
      note.labels = note.labels.filter(id => id !== labelId);
      note.updatedAt = new Date().toISOString();
      await db.saveNote(note);
      await syncQueue.enqueue('notes', 'UPDATE', note.$id, note);
      eventBus.emit('notes:changed', { action: 'label-detached', note });
      eventBus.emit('sync:trigger');
    }
    return note;
  }
}
