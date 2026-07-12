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
  sanitizeReceiptFileName,
  validateReceipt,
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

test('receipt validation accepts only non-empty JPEG PNG or WebP up to 10 MB', () => {
  assert.deepEqual(validateReceipt({ size: 1, type: 'image/jpeg' }), { ok: true });
  assert.deepEqual(validateReceipt({ size: MAX_FILE_SIZE, type: 'image/webp' }), { ok: true });
  assert.deepEqual(validateReceipt({ size: 0, type: 'image/png' }), { ok: false, error: '收據檔案不可為空' });
  assert.deepEqual(validateReceipt({ size: 4, type: 'application/pdf' }), { ok: false, error: '收據只允許 JPEG、PNG 或 WebP' });
  assert.deepEqual(validateReceipt({ size: MAX_FILE_SIZE + 1, type: 'image/png' }), { ok: false, error: '收據超過 10 MB' });
});

test('receipt validation rejects missing and non-finite file sizes', () => {
  assert.deepEqual(validateReceipt({ type: 'image/jpeg' }), { ok: false, error: '收據檔案不可為空' });
  assert.deepEqual(validateReceipt({ size: 'abc', type: 'image/jpeg' }), { ok: false, error: '收據檔案不可為空' });
  assert.deepEqual(validateReceipt({ size: Number.NaN, type: 'image/jpeg' }), { ok: false, error: '收據檔案不可為空' });
  assert.deepEqual(validateReceipt({ size: Number.POSITIVE_INFINITY, type: 'image/jpeg' }), { ok: false, error: '收據檔案不可為空' });
});

test('sanitizes receipt storage names to a non-empty strict ASCII component', () => {
  assert.equal(sanitizeReceiptFileName('../My receipt (1).JPG'), 'My-receipt-1.JPG');
  assert.equal(sanitizeReceiptFileName('收據.jpg'), 'receipt.jpg');
  assert.equal(sanitizeReceiptFileName('🚀'), 'receipt');
  assert.match(sanitizeReceiptFileName('a/b\\c?.webp'), /^[A-Za-z0-9._-]+$/);
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

test('normalizes BOT rate metadata with a safe fallback', () => {
  const result = normalizeLegacyStore({
    rate: 21.4,
    rateSource: 'BOT cash sell',
    rateUpdatedBy: 'u1',
  });
  assert.equal(result.rate, 21.4);
  assert.equal(result.rateSource, 'BOT cash sell');
  assert.equal(result.rateUpdatedAt, null);
  assert.equal(result.rateUpdatedBy, 'u1');

  const fallback = normalizeLegacyStore({ rateSource: 'other' });
  assert.equal(fallback.rate, 21.4);
  assert.equal(fallback.rateSource, 'BOT cash sell');
  assert.equal(fallback.rateUpdatedAt, null);
  assert.equal(fallback.rateUpdatedBy, '');
});
