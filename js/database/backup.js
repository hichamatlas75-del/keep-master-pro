/**
 * KEEP MASTER PRO - JSON Backup & Restore Engine
 * Independent offline backup, export and validated import.
 */

import { db } from './indexeddb.js';
import { APP_CONFIG } from '../config.js';
import { createNoteModel, createLabelModel } from './schema.js';
import { validateNote } from '../utils/sanitize.js';
import { eventBus } from '../utils/event-bus.js';

export class BackupEngine {
  /**
   * Export all notes, labels, and settings into a JSON backup file
   */
  static async exportBackup() {
    const notes = await db.getAllNotes();
    const labels = await db.getLabels();
    const theme = await db.getSetting('theme', 'dark');
    const viewMode = await db.getSetting('viewMode', 'grid');

    const backupData = {
      app: APP_CONFIG.APP_NAME,
      version: APP_CONFIG.VERSION,
      exportedAt: new Date().toISOString(),
      metadata: {
        notesCount: notes.length,
        labelsCount: labels.length
      },
      settings: {
        theme,
        viewMode
      },
      labels,
      notes
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `keep-master-pro-backup-${dateStr}.json`;

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    return {
      success: true,
      filename,
      notesCount: notes.length,
      labelsCount: labels.length
    };
  }

  /**
   * Import notes and labels from a JSON string with format validation and duplicate detection
   */
  static async importBackup(jsonString, options = { mergeStrategy: 'merge' }) {
    let parsed;
    try {
      parsed = JSON.parse(jsonString);
    } catch (e) {
      throw new Error('Format JSON invalide. Veuillez vérifier le fichier sélectionné.');
    }

    // Validate root structure
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Fichier de sauvegarde invalide.');
    }

    const rawNotes = Array.isArray(parsed.notes) ? parsed.notes : [];
    const rawLabels = Array.isArray(parsed.labels) ? parsed.labels : [];

    const report = {
      totalFound: rawNotes.length,
      importedNotes: 0,
      updatedNotes: 0,
      skippedNotes: 0,
      importedLabels: 0,
      errors: []
    };

    // 1. Import Labels
    for (const rawLabel of rawLabels) {
      if (rawLabel && rawLabel.name) {
        try {
          const label = createLabelModel(rawLabel);
          await db.saveLabel(label);
          report.importedLabels++;
        } catch (err) {
          report.errors.push(`Erreur libellé "${rawLabel.name}": ${err.message}`);
        }
      }
    }

    // 2. Fetch existing notes for duplicate detection
    const existingNotes = await db.getAllNotes();
    const existingMap = new Map();
    for (const n of existingNotes) {
      existingMap.set(n.$id, n);
    }

    // 3. Process each note
    for (const rawNote of rawNotes) {
      if (!validateNote(rawNote)) {
        report.skippedNotes++;
        report.errors.push(`Note ignorée car invalide: ${rawNote?.title || 'Sans titre'}`);
        continue;
      }

      const note = createNoteModel(rawNote);
      const existing = existingMap.get(note.$id);

      if (existing) {
        if (options.mergeStrategy === 'skip') {
          report.skippedNotes++;
          continue;
        }

        // Compare update dates
        const existingDate = new Date(existing.updatedAt).getTime();
        const incomingDate = new Date(note.updatedAt).getTime();

        if (incomingDate >= existingDate || options.mergeStrategy === 'overwrite') {
          await db.saveNote(note);
          report.updatedNotes++;
        } else {
          report.skippedNotes++;
        }
      } else {
        await db.saveNote(note);
        report.importedNotes++;
      }
    }

    // 4. Restore settings if present
    if (parsed.settings) {
      if (parsed.settings.theme) await db.setSetting('theme', parsed.settings.theme);
      if (parsed.settings.viewMode) await db.setSetting('viewMode', parsed.settings.viewMode);
    }

    // Notify listeners
    eventBus.emit('notes:changed', { action: 'import' });
    eventBus.emit('labels:changed');

    return report;
  }
}
