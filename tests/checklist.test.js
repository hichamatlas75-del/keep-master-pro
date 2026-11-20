import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ChecklistModule } from '../js/modules/checklist.js';

describe('Checklist Module Tests', () => {
  test('addItem should append new item to checklist', () => {
    const list = [];
    const updated = ChecklistModule.addItem(list, 'Faire les courses');

    assert.equal(updated.length, 1);
    assert.equal(updated[0].text, 'Faire les courses');
    assert.equal(updated[0].completed, false);
    assert.ok(updated[0].id);
  });

  test('addItem should allow adding empty item when allowEmpty is true and insert after specified index', () => {
    const list = [
      { id: '1', text: 'Première tâche', completed: false },
      { id: '2', text: 'Deuxième tâche', completed: false }
    ];
    // Insert new item between 1 and 2
    const updated = ChecklistModule.addItem(list, '', true, 0);

    assert.equal(updated.length, 3);
    assert.equal(updated[0].id, '1');
    assert.equal(updated[1].text, '');
    assert.equal(updated[1].completed, false);
    assert.equal(updated[2].id, '2');
  });

  test('toggleItem should flip completed flag and move item to bottom', () => {
    const list = [
      { id: '1', text: 'Tâche 1', completed: false },
      { id: '2', text: 'Tâche 2', completed: false },
      { id: '3', text: 'Tâche 3', completed: false }
    ];

    // Check item 1
    const checked = ChecklistModule.toggleItem(list, '1');

    assert.equal(checked[checked.length - 1].id, '1');
    assert.equal(checked[checked.length - 1].completed, true);
    assert.equal(checked[0].id, '2');
    assert.equal(checked[1].id, '3');

    // Uncheck item 1
    const unchecked = ChecklistModule.toggleItem(checked, '1');
    assert.equal(unchecked.find(i => i.id === '1').completed, false);
  });

  test('removeItem should delete specific item', () => {
    const list = [
      { id: '1', text: 'A', completed: false },
      { id: '2', text: 'B', completed: false }
    ];
    const updated = ChecklistModule.removeItem(list, '1');
    assert.equal(updated.length, 1);
    assert.equal(updated[0].id, '2');
  });

  test('reorder should correctly change order of items', () => {
    const list = [
      { id: '1', text: 'A', completed: false },
      { id: '2', text: 'B', completed: false },
      { id: '3', text: 'C', completed: false }
    ];
    const reordered = ChecklistModule.reorder(list, 0, 2);
    assert.equal(reordered[0].id, '2');
    assert.equal(reordered[1].id, '3');
    assert.equal(reordered[2].id, '1');
  });
});
