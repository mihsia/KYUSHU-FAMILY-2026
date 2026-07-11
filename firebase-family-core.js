export const TRIP_ID = 'kyushu-2026';
export const MAX_FILE_SIZE = 10 * 1024 * 1024;
export const ALLOWED_EMAILS = Object.freeze([
  'mihsia@gmail.com',
  'pandora0119@gmail.com',
]);

const DOCUMENT_CATEGORIES = Object.freeze(['機票', '住宿', 'VJW', '保險', '其他']);
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function cleanEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function isAllowedEmail(email) {
  return ALLOWED_EMAILS.includes(cleanEmail(email));
}

export function roleForEmail(email) {
  const value = cleanEmail(email);
  if (value === 'mihsia@gmail.com') return 'admin';
  if (value === 'pandora0119@gmail.com') return 'member';
  return null;
}

export function sanitizeFileName(name) {
  const value = String(name || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}._-]/gu, '-');
  return value || 'document';
}

export function validateUpload(file) {
  if (!file || Number(file.size) > MAX_FILE_SIZE) {
    return { ok: false, error: '檔案超過 10 MB' };
  }
  if (!ALLOWED_TYPES.has(String(file.type || '').toLowerCase())) {
    return { ok: false, error: '只允許 PDF、JPEG、PNG 或 WebP' };
  }
  return { ok: true };
}

export function validateReceipt(file) {
  if (!file || Number(file.size) <= 0) return { ok: false, error: '收據檔案不可為空' };
  if (Number(file.size) > MAX_FILE_SIZE) return { ok: false, error: '收據超過 10 MB' };
  if (!RECEIPT_TYPES.has(String(file.type || '').toLowerCase())) {
    return { ok: false, error: '收據只允許 JPEG、PNG 或 WebP' };
  }
  return { ok: true };
}

export function normalizeLegacyStore(input = {}) {
  const source = input && typeof input === 'object' ? input : {};
  const documents = Object.fromEntries(DOCUMENT_CATEGORIES.map((category) => [
    category,
    Array.isArray(source.documents?.[category]) ? [...source.documents[category]] : [],
  ]));
  return {
    wishlist: Array.isArray(source.wishlist) ? source.wishlist.map((item) => ({ ...item })) : [],
    mustbuy: Array.isArray(source.mustbuy) ? source.mustbuy.map((item) => ({ ...item })) : [],
    packingChecked: source.packingChecked && typeof source.packingChecked === 'object'
      ? { ...source.packingChecked }
      : {},
    documents,
    expenses: Array.isArray(source.expenses) ? source.expenses.map((item) => ({ ...item })) : [],
    rate: Number.isFinite(Number(source.rate)) ? Number(source.rate) : 21.4,
    rateSource: source.rateSource === 'BOT cash sell' ? source.rateSource : 'BOT cash sell',
    rateUpdatedAt: source.rateUpdatedAt || null,
    rateUpdatedBy: String(source.rateUpdatedBy || ''),
  };
}
