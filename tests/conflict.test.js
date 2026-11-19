import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ConflictManager } from '../js/sync/conflict-manager.js';

describe('Conflict Resolution Manager Tests', () => {
  test('resolve should return identical note when no edits occurred', () => {
    const local = {
      $id: '1',
      title: 'Note A',
      content: 'Contenu identique',
      updatedAt: '2026-11-19T10:00:00Z',
      version: 1
    };
    const remote = {
      $id: '1',
      title: 'Note A',
      content: 'Contenu identique',
      updatedAt: '2026-11-19T10:00:00Z',
      version: 1
    };

    const { resolvedNote, conflictCopy } = ConflictManager.resolve(local, remote);
    assert.equal(conflictCopy, null);
    assert.equal(resolvedNote.$id, '1');
    assert.equal(resolvedNote.title, 'Note A');
  });

  test('resolve should choose latest timestamp for normal edits', () => {
    const local = {
      $id: '1',
      title: 'Titre Local',
      content: 'Local text',
      updatedAt: '2026-11-19T11:00:00Z',
      version: 2
    };
    const remote = {
      $id: '1',
      title: 'Titre Remote Ancien',
      content: 'Old text',
      updatedAt: '2026-11-19T10:00:00Z',
      version: 1
    };

    const { resolvedNote, conflictCopy } = ConflictManager.resolve(local, remote);
    assert.equal(conflictCopy, null);
    assert.equal(resolvedNote.title, 'Titre Local');
    assert.equal(resolvedNote.content, 'Local text');
  });

  test('resolve should create a conflict copy when concurrent conflicting edits occur', () => {
    const now = new Date().toISOString();
    const local = {
      $id: '1',
      title: 'Note Concurrente',
      content: 'Modification sur Téléphone',
      updatedAt: now,
      version: 2
    };
    const remote = {
      $id: '1',
      title: 'Note Concurrente',
      content: 'Modification sur Ordinateur',
      updatedAt: now,
      version: 2
    };

    const { resolvedNote, conflictCopy } = ConflictManager.resolve(local, remote);

    // Conflict copy must be created so zero user text is lost!
    assert.ok(conflictCopy !== null);
    assert.ok(conflictCopy.title.includes('Copie de conflit'));
    assert.equal(conflictCopy.content, 'Modification sur Ordinateur');
    assert.equal(resolvedNote.content, 'Modification sur Téléphone');
  });

  test('resolve should smartly merge labels from both devices', () => {
    const local = {
      $id: '1',
      title: 'Note Labels',
      labels: ['label1', 'label2'],
      updatedAt: '2026-11-19T11:00:00Z',
      version: 2
    };
    const remote = {
      $id: '1',
      title: 'Note Labels',
      labels: ['label2', 'label3'],
      updatedAt: '2026-11-19T10:00:00Z',
      version: 1
    };

    const { resolvedNote } = ConflictManager.resolve(local, remote);
    assert.ok(resolvedNote.labels.includes('label1'));
    assert.ok(resolvedNote.labels.includes('label2'));
    assert.ok(resolvedNote.labels.includes('label3'));
  });
});
