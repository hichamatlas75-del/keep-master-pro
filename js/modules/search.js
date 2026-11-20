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
  static search(notes, { query = '', color = null, type = null, label = null, pinned = null, archived = undefined, trashed = undefined } = {}) {
    if (!Array.isArray(notes)) return [];

    const normalizedQuery = this.normalize(query);

    return notes.filter((note) => {
      // 1. Base status filter (trashed / archived)
      // Only filter by trashed/archived if explicitly specified in options
      if (trashed !== undefined && trashed !== null && Boolean(note.trashed) !== Boolean(trashed)) {
        return false;
      }
      if (archived !== undefined && archived !== null && Boolean(note.archived) !== Boolean(archived)) {
        return false;
      }

      // 2. Pinned filter
      if (pinned !== null && pinned !== undefined && Boolean(note.pinned) !== Boolean(pinned)) {
        return false;
      }

      // 3. Color filter
      if (color && note.color !== color) {
        return false;
      }

      // 4. Note type filter ('text' | 'checklist' | 'drawing' | 'audio')
      if (type) {
        if (type === 'drawing') {
          const hasDrawingAttachment = Array.isArray(note.attachments) &&
            note.attachments.some(a => a?.kind === 'drawing' || a?.name?.startsWith('drawing-'));
          if (note.type !== 'drawing' && !hasDrawingAttachment) {
            return false;
          }
        } else if (type === 'audio') {
          const hasAudioAttachment = Array.isArray(note.attachments) &&
            note.attachments.some(a => a?.kind === 'audio' || a?.type?.startsWith('audio/'));
          if (note.type !== 'audio' && !hasAudioAttachment) {
            return false;
          }
        } else if (note.type !== type) {
          return false;
        }
      }

      // 5. Label filter
      if (label && (!Array.isArray(note.labels) || !note.labels.includes(label))) {
        return false;
      }

      // 6. Text query search (matches title, content, checklist items, and OCR extracted text from images/drawings)
      if (normalizedQuery) {
        const titleMatch = this.normalize(note.title).includes(normalizedQuery);
        const contentMatch = this.normalize(note.content).includes(normalizedQuery);
        const checklistMatch = Array.isArray(note.checklist) && note.checklist.some(
          item => this.normalize(item.text).includes(normalizedQuery)
        );
        const ocrMatch = Array.isArray(note.attachments) && note.attachments.some(
          att => att && att.extractedText && this.normalize(att.extractedText).includes(normalizedQuery)
        );

        if (!titleMatch && !contentMatch && !checklistMatch && !ocrMatch) {
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
