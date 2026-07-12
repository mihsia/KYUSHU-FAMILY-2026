export const IMPORT_CATEGORIES = Object.freeze(['餐飲', '交通', '住宿', '購物', '門票', '其他']);

const DATE_TO_DAY = Object.freeze({
  '2026-07-13': 0,
  '2026-07-14': 1,
  '2026-07-15': 2,
  '2026-07-16': 3,
  '2026-07-17': 4,
});

const CURRENCIES = Object.freeze(['JPY', 'TWD']);

export const CHATGPT_RECEIPT_PROMPT = `請辨識我上傳的所有收據，並且只輸出 JSON，不要加入 Markdown、程式碼框、解釋或其他文字。
輸出 {"version": 1,"expenses":[...]}；date 用 YYYY-MM-DD；amount 用數字；currency 只能是 JPY 或 TWD；category 只能是餐飲、交通、住宿、購物、門票、其他；每筆包含 date、merchant、amount、currency、category、description、items、confidence、notes。`;

export function duplicateKey(row) {
  return [
    row.date,
    String(row.merchant || '').trim().toLocaleLowerCase(),
    Number(row.amount),
    row.currency,
  ].join('|');
}

function isFinitePositive(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function validateString(errors, label, value, maximum, allowEmpty = true) {
  if (typeof value !== 'string' || (!allowEmpty && value.trim() === '') || value.length > maximum) {
    errors.push(`${label} 必須是${allowEmpty ? '' : '非空'}字串且不超過 ${maximum} 字`);
  }
}

function validateRow(row, index, errors) {
  const path = `第 ${index + 1} 筆`;
  if (!row || typeof row !== 'object' || Array.isArray(row)) {
    errors.push(`${path} 必須是物件`);
    return;
  }

  if (!Object.hasOwn(DATE_TO_DAY, row.date)) errors.push(`${path} 日期不在旅遊期間`);
  validateString(errors, `${path} merchant`, row.merchant, 100, false);
  if (!isFinitePositive(row.amount) || row.amount > 10000000) errors.push(`${path} amount 必須是有限正數且不超過 10000000`);
  if (!CURRENCIES.includes(row.currency)) errors.push(`${path} currency 只能是 JPY 或 TWD`);
  if (!IMPORT_CATEGORIES.includes(row.category)) errors.push(`${path} category 不支援`);
  validateString(errors, `${path} description`, row.description, 300);
  validateString(errors, `${path} notes`, row.notes, 300);

  if (typeof row.confidence !== 'number' || !Number.isFinite(row.confidence)
      || row.confidence < 0 || row.confidence > 1) {
    errors.push(`${path} confidence 必須介於 0 到 1`);
  }

  if (!Array.isArray(row.items) || row.items.length > 10) {
    errors.push(`${path} items 必須是最多 10 筆的陣列`);
    return;
  }
  row.items.forEach((item, itemIndex) => {
    const itemPath = `${path} items 第 ${itemIndex + 1} 筆`;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${itemPath} 必須是物件`);
      return;
    }
    validateString(errors, `${itemPath} name`, item.name, 100, false);
    if (!isFinitePositive(item.quantity)) errors.push(`${itemPath} quantity 必須是有限正數`);
    if (!isFinitePositive(item.amount)) errors.push(`${itemPath} amount 必須是有限正數`);
  });
}

export function parseReceiptImport(text, existingExpenses = []) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { ok: false, rows: [], errors: ['無法讀取 JSON，請確認沒有 Markdown 程式碼框或其他文字'] };
  }

  const errors = [];
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    errors.push('最外層資料必須是 JSON 物件');
  } else {
    if (data.version !== 1) errors.push('不支援的版本，version 必須是 1');
    if (!Array.isArray(data.expenses) || data.expenses.length < 1 || data.expenses.length > 50) {
      errors.push('expenses 必須包含 1 到 50 筆資料');
    } else {
      data.expenses.forEach((row, index) => validateRow(row, index, errors));
    }
  }

  if (errors.length) return { ok: false, rows: [], errors };

  const existingKeys = new Set(existingExpenses.map((expense) => duplicateKey({
    date: expense.date ?? expense.importDate,
    merchant: expense.merchant,
    amount: expense.amount ?? expense.originalAmount,
    currency: expense.currency ?? expense.originalCurrency,
  })));
  const rows = data.expenses.map((row) => ({
    ...row,
    day: DATE_TO_DAY[row.date],
    duplicate: existingKeys.has(duplicateKey(row)),
  }));
  return { ok: true, rows, errors: [] };
}

export function normalizeImportRow(row, rate) {
  const originalAmount = Number(row.amount);
  const jpy = row.currency === 'JPY'
    ? originalAmount
    : Math.round(originalAmount * 100 / Number(rate));
  return {
    day: DATE_TO_DAY[row.date],
    category: row.category,
    note: String(row.description || row.merchant).trim(),
    jpy,
    originalAmount,
    originalCurrency: row.currency,
    importSource: 'chatgpt-json-v1',
    merchant: String(row.merchant).trim(),
    items: row.items.map(({ name, quantity, amount }) => ({
      name: String(name).trim(),
      quantity: Number(quantity),
      amount: Number(amount),
    })),
    confidence: Number(row.confidence),
    importNotes: String(row.notes || '').trim(),
    importDate: row.date,
  };
}
