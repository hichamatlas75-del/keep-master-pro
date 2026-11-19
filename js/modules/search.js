/**
 * KEEP MASTER PRO - Instant Search & Multi-Filter Engine
 * Search across titles, content, checklist items, and labels with advanced filter criteria.
 */

export class SearchModule {
  /**
   * Filter and search notes
   * @param {Array} notes - List of notes to filter
   * @param {Object} query - Search query and filters
   * @returns {Array} Filtered notes
   */
  static search(notes, { query = '', color = null, type = null, label = null, pinned = null, archived = false, trashed = false } = {}) {
    if (!Array.isArray(notes)) return [];

    const normalizedQuery = this.normalize(query);

    return notes.filter((note) => {
      // 1. Base status filter (trashed / archived)
      if (trashed !== undefined && Boolean(note.trashed) !== Boolean(trashed)) {
        return false;
      }
      if (!trashed && archived !== undefined && Boolean(note.archived) !== Boolean(archived)) {
        return false;
      }

      // 2. Pinned filter
      if (pinned !== null && Boolean(note.pinned) !== Boolean(pinned)) {
        return false;
      }

      // 3. Color filter
      if (color && note.color !== color) {
        return false;
      }

      // 4. Note type filter ('text' | 'checklist' | 'drawing' | 'audio')
      if (type && note.type !== type) {
        return false;
      }

      // 5. Label filter
      if (label && (!Array.isArray(note.labels) || !note.labels.includes(label))) {
        return false;
      }

      // 6. Text query search (matches title, content, checklist items)
      if (normalizedQuery) {
        const titleMatch = this.normalize(note.title).includes(normalizedQuery);
        const contentMatch = this.normalize(note.content).includes(normalizedQuery);
        const checklistMatch = Array.isArray(note.checklist) && note.checklist.some(
          item => this.normalize(item.text).includes(normalizedQuery)
        );

        if (!titleMatch && !contentMatch && !checklistMatch) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Normalize string: lowercase, trim, remove accents
   */
  static normalize(str) {
    if (typeof str !== 'string') return '';
    return str
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }
}
