import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { SearchModule } from '../js/modules/search.js';

describe('Search & Filter Engine Tests', () => {
  const sampleNotes = [
    {
      $id: 'n1',
      title: 'Réunion Projet Keep',
      content: 'Discuter de la roadmap PWA et Firebase',
      color: 'coral',
      type: 'text',
      pinned: true,
      archived: false,
      trashed: false,
      labels: ['work']
    },
    {
      $id: 'n2',
      title: 'Liste de courses',
      content: '',
      color: 'mint',
      type: 'checklist',
      checklist: [
        { id: 'c1', text: 'Pommes Bio', completed: false },
        { id: 'c2', text: 'Café noir', completed: true }
      ],
      pinned: false,
      archived: false,
      trashed: false,
      labels: ['perso']
    },
    {
      $id: 'n3',
      title: 'Ancienne idée',
      content: 'Archive de l\'année dernière',
      color: 'default',
      type: 'text',
      pinned: false,
      archived: true,
      trashed: false,
      labels: []
    }
  ];

  test('search should match titles with case and accent insensitivity', () => {
    // "reunion" matches "Réunion"
    const results = SearchModule.search(sampleNotes, { query: 'reunion' });
    assert.equal(results.length, 1);
    assert.equal(results[0].$id, 'n1');
  });

  test('search should match checklist item text', () => {
    const results = SearchModule.search(sampleNotes, { query: 'pommes' });
    assert.equal(results.length, 1);
    assert.equal(results[0].$id, 'n2');
  });

  test('search should filter by note color', () => {
    const results = SearchModule.search(sampleNotes, { color: 'mint' });
    assert.equal(results.length, 1);
    assert.equal(results[0].$id, 'n2');
  });

  test('search should filter by note type', () => {
    const results = SearchModule.search(sampleNotes, { type: 'checklist' });
    assert.equal(results.length, 1);
    assert.equal(results[0].$id, 'n2');
  });

  test('search should filter by label', () => {
    const results = SearchModule.search(sampleNotes, { label: 'work' });
    assert.equal(results.length, 1);
    assert.equal(results[0].$id, 'n1');
  });

  test('search should filter by archived status when explicitly requested', () => {
    const archivedOnly = SearchModule.search(sampleNotes, { archived: true });
    assert.equal(archivedOnly.length, 1);
    assert.equal(archivedOnly[0].$id, 'n3');

    const unarchivedOnly = SearchModule.search(sampleNotes, { archived: false });
    assert.equal(unarchivedOnly.length, 2);
    assert.deepEqual(unarchivedOnly.map(n => n.$id), ['n1', 'n2']);
  });

  test('search should not drop archived notes when searching inside archive view collection', () => {
    // When viewing archives, notes passed into search are already archived notes
    const archiveViewNotes = sampleNotes.filter(n => n.archived);
    const results = SearchModule.search(archiveViewNotes, { query: 'ancienne' });
    assert.equal(results.length, 1);
    assert.equal(results[0].$id, 'n3');
  });
});
