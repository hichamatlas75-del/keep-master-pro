/**
 * KEEP MASTER PRO - Data Schemas and Factories
 * Conforms to Cloud Firestore and IndexedDB data contracts.
 */

import { generateId } from '../utils/helpers.js';
import { sanitizeTitle, sanitizeText } from '../utils/sanitize.js';

/**
 * Note Factory
 */
export function createNoteModel(data = {}) {
  const now = new Date().toISOString();
  return {
    $id: data.$id || generateId(),
    userId: data.userId || 'guest',
    title: sanitizeTitle(data.title || ''),
    content: sanitizeText(data.content || ''),
    type: data.type || 'text', // 'text' | 'checklist' | 'drawing' | 'audio'
    color: data.color || 'default', // one of 10 colors
    pinned: Boolean(data.pinned),
    archived: Boolean(data.archived),
    trashed: Boolean(data.trashed),
    checklist: Array.isArray(data.checklist) ? data.checklist : [],
    labels: Array.isArray(data.labels) ? data.labels : [],
    reminder: data.reminder ? {
      date: data.reminder.date || null,
      repeat: data.reminder.repeat || 'none', // 'none' | 'daily' | 'weekly'
      completed: Boolean(data.reminder.completed)
    } : null,
    attachments: Array.isArray(data.attachments) ? data.attachments : [],
    createdAt: data.createdAt || now,
    updatedAt: data.updatedAt || now,
    version: Number(data.version) || 1,
    deletedAt: data.deletedAt || null
  };
}

/**
 * Label Factory
 */
export function createLabelModel(data = {}) {
  return {
    $id: data.$id || generateId(),
    userId: data.userId || 'guest',
    name: sanitizeText(data.name || ''),
    color: data.color || 'default',
    createdAt: data.createdAt || new Date().toISOString()
  };
}

/**
 * Reminder Factory
 */
export function createReminderModel(data = {}) {
  return {
    $id: data.$id || generateId(),
    userId: data.userId || 'guest',
    noteId: data.noteId || '',
    date: data.date || new Date().toISOString(),
    completed: Boolean(data.completed)
  };
}

/**
 * Share Factory
 */
export function createShareModel(data = {}) {
  return {
    $id: data.$id || generateId(),
    noteId: data.noteId || '',
    ownerId: data.ownerId || 'guest',
    sharedWith: data.sharedWith || '', // user ID or email
    permission: data.permission || 'read', // 'read' | 'write'
    createdAt: data.createdAt || new Date().toISOString()
  };
}
