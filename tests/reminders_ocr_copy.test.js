import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { RemindersModule } from '../js/modules/reminders.js';
import { notifications } from '../js/utils/notifications.js';
import { toLocalDatetimeString } from '../js/utils/helpers.js';
import { OCRModule } from '../js/modules/ocr.js';
import { ShareModule } from '../js/modules/share.js';
import { db } from '../js/database/indexeddb.js';
import { NotesModule } from '../js/modules/notes.js';

describe('Reminders System Tests', () => {
  test('toLocalDatetimeString formats dates correctly into YYYY-MM-DDTHH:mm without UTC shift', () => {
    const d = new Date(2026, 10, 20, 14, 30); // 20 Nov 2026 14:30 local time
    const formatted = toLocalDatetimeString(d);
    assert.equal(formatted, '2026-11-20T14:30');
  });

  test('setReminder configures note reminder with repeat and active status', async () => {
    let savedNote = null;
    const origUpdate = NotesModule.updateNote;
    NotesModule.updateNote = async (id, updates) => {
      savedNote = { $id: id, ...updates };
      return savedNote;
    };

    const targetDate = '2026-11-20T18:00:00.000Z';
    await RemindersModule.setReminder('note-reminder-1', targetDate, 'daily');

    assert.equal(savedNote.$id, 'note-reminder-1');
    assert.equal(savedNote.reminder.date, targetDate);
    assert.equal(savedNote.reminder.repeat, 'daily');
    assert.equal(savedNote.reminder.completed, false);

    NotesModule.updateNote = origUpdate;
  });

  test('triggerReminder advances recurring daily reminder and reschedules', async () => {
    let updatedReminder = null;
    const origUpdate = NotesModule.updateNote;
    NotesModule.updateNote = async (id, updates) => {
      if (updates.reminder) updatedReminder = updates.reminder;
      return { $id: id, ...updates };
    };

    // Note with a reminder set 10 minutes in the past with repeat = 'daily'
    const pastDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const mockNote = {
      $id: 'note-daily',
      title: 'Rappel quotidien',
      reminder: {
        date: pastDate,
        repeat: 'daily',
        completed: false
      }
    };

    await notifications.triggerReminder(mockNote);

    // Give microtask queue time for async update
    await new Promise(r => setTimeout(r, 20));

    assert.ok(updatedReminder, 'Reminder must be updated');
    assert.equal(updatedReminder.repeat, 'daily');
    assert.equal(updatedReminder.completed, false, 'Daily reminder must remain active');
    assert.ok(new Date(updatedReminder.date).getTime() > Date.now(), 'Next date must be in the future');

    NotesModule.updateNote = origUpdate;
  });

  test('triggerReminder advances recurring weekly reminder and reschedules', async () => {
    let updatedReminder = null;
    const origUpdate = NotesModule.updateNote;
    NotesModule.updateNote = async (id, updates) => {
      if (updates.reminder) updatedReminder = updates.reminder;
      return { $id: id, ...updates };
    };

    const pastDate = new Date(Date.now() - 10000).toISOString();
    const mockNote = {
      $id: 'note-weekly',
      title: 'Rappel hebdomadaire',
      reminder: {
        date: pastDate,
        repeat: 'weekly',
        completed: false
      }
    };

    await notifications.triggerReminder(mockNote);
    await new Promise(r => setTimeout(r, 20));

    assert.ok(updatedReminder);
    assert.equal(updatedReminder.repeat, 'weekly');
    assert.equal(updatedReminder.completed, false);
    // Should be at least 6 days in future
    const diffDays = (new Date(updatedReminder.date).getTime() - Date.now()) / (1000 * 3600 * 24);
    assert.ok(diffDays >= 6.5, 'Next weekly date must be approximately 7 days ahead');

    NotesModule.updateNote = origUpdate;
  });

  test('triggerReminder marks non-recurring reminder as completed', async () => {
    let updatedReminder = null;
    const origUpdate = NotesModule.updateNote;
    NotesModule.updateNote = async (id, updates) => {
      if (updates.reminder) updatedReminder = updates.reminder;
      return { $id: id, ...updates };
    };

    const mockNote = {
      $id: 'note-single',
      title: 'Rappel unique',
      reminder: {
        date: new Date(Date.now() - 5000).toISOString(),
        repeat: 'none',
        completed: false
      }
    };

    await notifications.triggerReminder(mockNote);
    await new Promise(r => setTimeout(r, 20));

    assert.ok(updatedReminder);
    assert.equal(updatedReminder.completed, true, 'Non-recurring reminder must be marked completed');

    NotesModule.updateNote = origUpdate;
  });
});

describe('Reinforced OCR Tests', () => {
  test('cleanExtractedText filters out typical OCR noise and collapses whitespace', () => {
    const rawOcr = `
      Reçu de caisse #4589
      ~
      Total TTC : 42,50 €
      |
      •
      Merci de votre visite !
    `;

    const cleaned = OCRModule.cleanExtractedText(rawOcr);
    assert.ok(cleaned.includes('Reçu de caisse #4589'));
    assert.ok(cleaned.includes('Total TTC : 42,50 €'));
    assert.ok(cleaned.includes('Merci de votre visite !'));
    // Artifact lines like ~, |, • should be removed
    assert.ok(!cleaned.split('\n').includes('~'));
    assert.ok(!cleaned.split('\n').includes('|'));
    assert.ok(!cleaned.split('\n').includes('•'));
  });

  test('OCRModule.isSupported returns a boolean indicating browser capabilities', () => {
    const supported = OCRModule.isSupported();
    assert.equal(typeof supported, 'boolean');
  });
});

describe('Copy Note Functionality Tests', () => {
  test('formatNoteForCopy formats standard text notes with title and content', () => {
    const note = {
      title: 'Idées de projet',
      content: 'Créer une application moderne et ultra rapide.'
    };

    const formatted = ShareModule.formatNoteForCopy(note);
    assert.equal(formatted, 'Idées de projet\n\nCréer une application moderne et ultra rapide.');
  });

  test('formatNoteForCopy formats checklist notes with completion checkboxes', () => {
    const note = {
      title: 'Courses du week-end',
      type: 'checklist',
      checklist: [
        { id: '1', text: 'Pommes', completed: true },
        { id: '2', text: 'Café', completed: false },
        { id: '3', text: 'Pain complet', completed: false }
      ]
    };

    const formatted = ShareModule.formatNoteForCopy(note);
    assert.ok(formatted.startsWith('Courses du week-end'));
    assert.ok(formatted.includes('☑ Pommes'));
    assert.ok(formatted.includes('☐ Café'));
    assert.ok(formatted.includes('☐ Pain complet'));
  });

  test('formatNoteForCopy appends extracted OCR text if present on image attachments', () => {
    const note = {
      title: 'Facture scanner',
      content: 'Payée par virement.',
      attachments: [
        {
          id: 'att-1',
          name: 'scan.jpg',
          type: 'image/jpeg',
          extractedText: 'FACTURE N° 2026-11\nMONTANT : 150 €'
        }
      ]
    };

    const formatted = ShareModule.formatNoteForCopy(note);
    assert.ok(formatted.includes('Facture scanner'));
    assert.ok(formatted.includes('Payée par virement.'));
    assert.ok(formatted.includes('[Texte extrait (scan.jpg)]'));
    assert.ok(formatted.includes('FACTURE N° 2026-11'));
  });

  test('copyNote throws error if note has no content to copy', async () => {
    const emptyNote = {
      title: '',
      content: '',
      checklist: [],
      attachments: []
    };

    await assert.rejects(
      async () => ShareModule.copyNote(emptyNote),
      /La note est vide/
    );
  });
});
