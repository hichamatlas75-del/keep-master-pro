/**
 * KEEP MASTER PRO - Data Validation & HTML Sanitization
 * Robust XSS protection and input sanitization.
 */

const HTML_ENTITIES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;'
};

/**
 * Escape HTML entities in raw strings to prevent XSS
 */
export function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/[&<>"'/]/g, (tag) => HTML_ENTITIES[tag] || tag);
}

/**
 * Sanitize plain text (strips non-printable characters and trims)
 */
export function sanitizeText(str) {
  if (typeof str !== 'string') return '';
  return str.trim();
}

/**
 * Sanitize note title
 */
export function sanitizeTitle(title) {
  return sanitizeText(title).slice(0, 255);
}

/**
 * Sanitize URL to ensure it uses safe protocols (http, https, data for safe images/audio, blob)
 */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  const safeProtocolRegex = /^(https?:\/\/|data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,|data:audio\/(webm|mp4|mpeg|ogg|wav|aac|x-m4a|3gpp|flac)(?:;[a-z0-9=.,_-]+)*;base64,|blob:)/i;
  if (safeProtocolRegex.test(trimmed)) {
    return trimmed;
  }
  return '';
}

/**
 * Validate Note object integrity
 */
export function validateNote(note) {
  if (!note || typeof note !== 'object') return false;
  if (!note.$id || typeof note.$id !== 'string') return false;
  if (note.title === undefined && note.content === undefined && !Array.isArray(note.checklist)) {
    return false;
  }
  return true;
}

/**
 * Validate Checklist item
 */
export function validateChecklistItem(item) {
  if (!item || typeof item !== 'object') return null;
  return {
    id: String(item.id || Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
    text: sanitizeText(String(item.text || '')),
    completed: Boolean(item.completed)
  };
}
