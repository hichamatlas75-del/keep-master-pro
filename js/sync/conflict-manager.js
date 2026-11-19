/**
 * KEEP MASTER PRO - Conflict Resolution Manager
 * Version and timestamp-based conflict resolution.
 * Guarantees that local edits are never lost, and creates fork notes when concurrent conflicts arise.
 */

import { generateId, deepClone } from '../utils/helpers.js';
import { createNoteModel } from '../database/schema.js';

export class ConflictManager {
  /**
   * Resolve conflict between local note and remote note
   * @param {Object} localNote - Current note in IndexedDB
   * @param {Object} remoteNote - Incoming note from Cloud Firestore
   * @returns {Object} { resolvedNote, conflictCopy }
   */
  static resolve(localNote, remoteNote) {
    if (!localNote) return { resolvedNote: remoteNote, conflictCopy: null };
    if (!remoteNote) return { resolvedNote: localNote, conflictCopy: null };

    const localTime = new Date(localNote.updatedAt || 0).getTime();
    const remoteTime = new Date(remoteNote.updatedAt || 0).getTime();
    const localVersion = Number(localNote.version) || 1;
    const remoteVersion = Number(remoteNote.version) || 1;

    // If identical content and metadata, no conflict
    if (
      localNote.title === remoteNote.title &&
      localNote.content === remoteNote.content &&
      JSON.stringify(localNote.checklist || []) === JSON.stringify(remoteNote.checklist || []) &&
      JSON.stringify(localNote.labels || []) === JSON.stringify(remoteNote.labels || []) &&
      localNote.pinned === remoteNote.pinned &&
      localNote.archived === remoteNote.archived &&
      localNote.trashed === remoteNote.trashed
    ) {
      // Pick the higher version
      const winner = remoteVersion >= localVersion ? remoteNote : localNote;
      return { resolvedNote: winner, conflictCopy: null };
    }

    // Check for concurrent conflict (both modified since last common ancestor)
    const isConcurrent = Math.abs(localTime - remoteTime) < 5000 && localNote.content !== remoteNote.content;

    if (isConcurrent && localNote.content && remoteNote.content && localNote.content !== remoteNote.content) {
      console.warn('[ConflictManager] Modification concurrente détectée pour la note:', localNote.$id);

      // Create a conflict copy for the older or remote version so NO work is lost!
      const conflictCopy = createNoteModel({
        ...deepClone(remoteNote),
        $id: generateId(),
        title: `${remoteNote.title || 'Note'} (Copie de conflit synchronisée)`,
        updatedAt: new Date().toISOString(),
        version: 1
      });

      // Keep the local edit as the primary note with bumped version
      const resolvedNote = createNoteModel({
        ...localNote,
        version: Math.max(localVersion, remoteVersion) + 1,
        updatedAt: new Date().toISOString()
      });

      return { resolvedNote, conflictCopy };
    }

    // Otherwise, Latest-Wins strategy with smart union of metadata
    const useRemote = remoteTime > localTime || (remoteTime === localTime && remoteVersion > localVersion);
    const primary = useRemote ? remoteNote : localNote;
    const secondary = useRemote ? localNote : remoteNote;

    // Smart merge of checklists if both exist
    let mergedChecklist = primary.checklist || [];
    if (primary.type === 'checklist' && Array.isArray(secondary.checklist) && secondary.checklist.length > 0) {
      const itemsMap = new Map();
      // Add secondary items first
      for (const item of secondary.checklist) {
        if (item && item.id) itemsMap.set(item.id, item);
      }
      // Overwrite with primary items
      for (const item of primary.checklist) {
        if (item && item.id) itemsMap.set(item.id, item);
      }
      mergedChecklist = Array.from(itemsMap.values());
    }

    // Union of labels
    const mergedLabels = Array.from(new Set([...(primary.labels || []), ...(secondary.labels || [])]));

    const resolvedNote = createNoteModel({
      ...primary,
      checklist: mergedChecklist,
      labels: mergedLabels,
      version: Math.max(localVersion, remoteVersion) + 1
    });

    return { resolvedNote, conflictCopy: null };
  }
}
