import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML, sanitizeText, sanitizeTitle, sanitizeUrl, validateNote, validateChecklistItem } from '../js/utils/sanitize.js';

describe('Sanitize & Security Tests', () => {
  test('escapeHTML should escape dangerous characters to prevent XSS', () => {
    const maliciousInput = '<script>alert("xss")</script>&<img src="x" onerror="steal()"/>';
    const escaped = escapeHTML(maliciousInput);

    assert.ok(!escaped.includes('<script>'));
    assert.ok(!escaped.includes('</script>'));
    assert.ok(escaped.includes('&lt;script&gt;'));
    assert.ok(escaped.includes('&amp;'));
    assert.ok(escaped.includes('&quot;'));
  });

  test('sanitizeUrl should allow safe protocols and reject javascript:', () => {
    assert.equal(sanitizeUrl('https://example.com/image.png'), 'https://example.com/image.png');
    assert.equal(sanitizeUrl('http://example.com/pic.jpg'), 'http://example.com/pic.jpg');
    assert.equal(sanitizeUrl('data:image/png;base64,iVBORw0KGgoAAAANSUhEUg=='), 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');
    assert.equal(sanitizeUrl('blob:http://localhost:3000/12345'), 'blob:http://localhost:3000/12345');

    // Malicious URLs must be rejected
    assert.equal(sanitizeUrl('javascript:alert(1)'), '');
    assert.equal(sanitizeUrl('JAVASCRIPT:steal()'), '');
    assert.equal(sanitizeUrl('vbscript:msgbox(1)'), '');
  });

  test('validateNote should validate note schema and reject malformed objects', () => {
    assert.equal(validateNote(null), false);
    assert.equal(validateNote({}), false);
    assert.equal(validateNote({ $id: '123', title: 'Test note' }), true);
    assert.equal(validateNote({ $id: '123', checklist: [] }), true);
  });

  test('validateChecklistItem should sanitize checklist text', () => {
    const item = validateChecklistItem({ text: '  Acheter du pain  ', completed: true });
    assert.equal(item.text, 'Acheter du pain');
    assert.equal(item.completed, true);
    assert.ok(typeof item.id === 'string');
  });
});
