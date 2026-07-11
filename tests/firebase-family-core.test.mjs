import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOWED_EMAILS,
  MAX_FILE_SIZE,
  TRIP_ID,
  isAllowedEmail,
  normalizeLegacyStore,
  roleForEmail,
  sanitizeFileName,
  validateUpload,
} from '../firebase-family-core.js';

test('exports fixed trip and case-insensitive allow-list roles', () => {
  assert.equal(TRIP_ID, 'kyushu-2026');
  assert.deepEqual(ALLOWED_EMAILS, ['mihsia@gmail.com', 'pandora0119@gmail.com']);
  assert.equal(isAllowedEmail(' MIHSIA@gmail.com '), true);
  assert.equal(roleForEmail('mihsia@gmail.com'), 'admin');
  assert.equal(roleForEmail('pandora0119@gmail.com'), 'member');
  assert.equal(roleForEmail('outsider@gmail.com'), null);
});

test('sanitizes file names without discarding the extension', () => {
  assert.equal(sanitizeFileName('../機票 2026?.pdf'), '機票-2026-.pdf');
  assert.equal(sanitizeFileName('   '), 'document');
});

test('validates supported uploads up to 10 MB', () => {
  assert.deepEqual(validateUpload({ size: MAX_FILE_SIZE, type: 'application/pdf' }), { ok: true });
  assert.deepEqual(validateUpload({ size: MAX_FILE_SIZE + 1, type: 'application/pdf' }), { ok: false, error: '檔案超過 10 MB' });
  assert.deepEqual(validateUpload({ size: 10, type: 'text/html' }), { ok: false, error: '只允許 PDF、JPEG、PNG 或 WebP' });
});

test('normalizes legacy state without mutating it', () => {
  const source = { rate: 22, wishlist: [{ id: 'w1', text: '藥妝' }] };
  const result = normalizeLegacyStore(source);
  assert.notEqual(result, source);
  assert.equal(result.rate, 22);
  assert.equal(result.wishlist.length, 1);
  assert.deepEqual(result.expenses, []);
  assert.deepEqual(result.documents, { 機票: [], 住宿: [], VJW: [], 保險: [], 其他: [] });
  assert.deepEqual(source, { rate: 22, wishlist: [{ id: 'w1', text: '藥妝' }] });
});
