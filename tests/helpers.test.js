import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { formatDateTime, formatFileSize, deepClone, compressImage } from '../js/utils/helpers.js';

describe('Helper Utilities Tests', () => {
  test('formatFileSize should format bytes into human readable string', () => {
    assert.equal(formatFileSize(0), '0 B');
    assert.equal(formatFileSize(1024), '1 Ko');
    assert.equal(formatFileSize(1048576), '1 Mo');
    assert.equal(formatFileSize(null), '0 B');
  });

  test('deepClone should produce a disconnected deep clone of nested objects', () => {
    const orig = { a: 1, b: [1, 2, { c: 3 }] };
    const clone = deepClone(orig);
    assert.deepEqual(clone, orig);
    clone.b[2].c = 99;
    assert.equal(orig.b[2].c, 3);
  });

  test('compressImage should return original object gracefully in non-browser Node runtime', async () => {
    const dummyBlob = { size: 1000, type: 'image/jpeg' };
    const res = await compressImage(dummyBlob);
    assert.equal(res, dummyBlob);
  });

  test('formatDateTime should format valid ISO timestamps gracefully', () => {
    const res = formatDateTime('2026-11-19T20:00:00Z');
    assert.ok(typeof res === 'string');
    assert.ok(res.length > 0);
  });
});
