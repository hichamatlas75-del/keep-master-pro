/**
 * KEEP MASTER PRO - Checklist Module
 * Item management, checkboxes, reordering, and automatic moving of completed items to bottom.
 */

import { generateId, deepClone } from '../utils/helpers.js';
import { sanitizeText } from '../utils/sanitize.js';

export class ChecklistModule {
  /**
   * Add a new item to checklist
   * @param {Array} checklist
   * @param {string} text
   * @param {boolean} [allowEmpty=false]
   * @param {number|null} [insertAfterIndex=null]
   */
  static addItem(checklist, text = '', allowEmpty = false, insertAfterIndex = null) {
    const cleanText = sanitizeText(text);
    if (!cleanText && !allowEmpty) return checklist;

    const list = deepClone(checklist || []);
    const newItem = {
      id: generateId(),
      text: cleanText,
      completed: false
    };

    if (insertAfterIndex !== null && insertAfterIndex !== undefined && insertAfterIndex >= 0 && insertAfterIndex < list.length) {
      list.splice(insertAfterIndex + 1, 0, newItem);
      return list;
    }

    // Insert before first completed item if any
    const firstCompletedIndex = list.findIndex(i => i.completed);
    if (firstCompletedIndex !== -1) {
      list.splice(firstCompletedIndex, 0, newItem);
    } else {
      list.push(newItem);
    }

    return list;
  }

  /**
   * Toggle item completion and automatically move completed items to the bottom
   */
  static toggleItem(checklist, itemId) {
    const list = deepClone(checklist || []);
    const item = list.find(i => i.id === itemId);
    if (!item) return list;

    item.completed = !item.completed;
    return this.sortCompletedToBottom(list);
  }

  /**
   * Remove an item from checklist
   */
  static removeItem(checklist, itemId) {
    const list = deepClone(checklist || []);
    return list.filter(i => i.id !== itemId);
  }

  /**
   * Update item text
   */
  static updateItemText(checklist, itemId, newText) {
    const list = deepClone(checklist || []);
    const item = list.find(i => i.id === itemId);
    if (item) {
      item.text = sanitizeText(newText);
    }
    return list;
  }

  /**
   * Reorder items
   */
  static reorder(checklist, fromIndex, toIndex) {
    const list = deepClone(checklist || []);
    if (fromIndex < 0 || fromIndex >= list.length || toIndex < 0 || toIndex >= list.length) {
      return list;
    }
    const [moved] = list.splice(fromIndex, 1);
    list.splice(toIndex, 0, moved);
    return list;
  }

  /**
   * Move completed items to the bottom
   */
  static sortCompletedToBottom(checklist) {
    const active = checklist.filter(i => !i.completed);
    const completed = checklist.filter(i => i.completed);
    return [...active, ...completed];
  }
}
