import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { validateNote } from '../js/utils/sanitize.js';
import { createNoteModel, createLabelModel } from '../js/database/schema.js';

describe('Backup & Schema Validation Tests', () => {
  test('createNoteModel should instantiate clean notes with default properties', () => {
    const note = createNoteModel({ title: 'Nouvelle note' });
    assert.ok(note.$id);
    assert.equal(note.title, 'Nouvelle note');
    assert.equal(note.color, 'default');
    assert.equal(note.pinned, false);
    assert.equal(note.archived, false);
    assert.equal(note.trashed, false);
    assert.deepEqual(note.checklist, []);
    assert.deepEqual(note.labels, []);
    assert.ok(note.createdAt);
    assert.ok(note.updatedAt);
    assert.equal(note.version, 1);
  });

  test('validateNote should accept valid notes and reject invalid payloads', () => {
    assert.equal(validateNote({ $id: 'n1', title: 'Test' }), true);
    assert.equal(validateNote({ $id: 'n2', content: 'Corps de la note' }), true);
    assert.equal(validateNote({ $id: 'n3', checklist: [{ text: 'Item', completed: false }] }), true);

    // Invalid
    assert.equal(validateNote(null), false);
    assert.equal(validateNote(undefined), false);
    assert.equal(validateNote('invalid-string'), false);
    assert.equal(validateNote({ title: 'Sans id' }), false);
  });

  test('createLabelModel should sanitize label name', () => {
    const label = createLabelModel({ name: '  Projet Urgent  ' });
    assert.ok(label.$id);
    assert.equal(label.name, 'Projet Urgent');
    assert.equal(label.color, 'default');
    assert.ok(label.createdAt);
  });
});
