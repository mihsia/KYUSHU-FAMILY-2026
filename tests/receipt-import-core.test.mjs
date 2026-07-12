import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHATGPT_RECEIPT_PROMPT,
  duplicateKey,
  normalizeImportRow,
  parseReceiptImport,
} from '../receipt-import-core.js';

const validRow = {
  date: '2026-07-13', merchant: '一蘭拉麵', amount: 2480,
  currency: 'JPY', category: '餐飲', description: '晚餐',
  items: [{ name: '拉麵', quantity: 2, amount: 1960 }],
  confidence: 0.96, notes: '',
};
const valid = JSON.stringify({ version: 1, expenses: [validRow] });

test('parses contract v1 and maps trip dates', () => {
  const result = parseReceiptImport(valid);
  assert.equal(result.ok, true);
  assert.equal(result.rows[0].day, 0);
  assert.equal(result.rows[0].duplicate, false);
});

test('rejects wrappers, unsupported values, and batches over 50', () => {
  assert.match(parseReceiptImport('```json\n{}\n```').errors[0], /無法讀取 JSON/);
  assert.match(parseReceiptImport(JSON.stringify({ version: 2, expenses: [] })).errors[0], /版本/);
  assert.match(parseReceiptImport(JSON.stringify({ version: 1, expenses: [{
    date: '2026-07-18', merchant: 'x', amount: -1, currency: 'USD',
    category: 'x', description: '', items: [], confidence: 2, notes: '',
  }] })).errors.join(' '), /日期|amount|currency|category|confidence/);
  assert.match(parseReceiptImport(JSON.stringify({
    version: 1, expenses: Array.from({ length: 51 }, () => validRow),
  })).errors[0], /50/);
});

test('reports row paths and returns no rows when validation fails', () => {
  const result = parseReceiptImport(JSON.stringify({
    version: 1,
    expenses: [validRow, { ...validRow, currency: 'USD' }],
  }));
  assert.equal(result.ok, false);
  assert.deepEqual(result.rows, []);
  assert.match(result.errors.join(' '), /第 2 筆 currency/);
});

test('enforces string and item limits and finite positive numbers', () => {
  const result = parseReceiptImport(JSON.stringify({
    version: 1,
    expenses: [{
      ...validRow,
      merchant: 'x'.repeat(101),
      amount: null,
      items: Array.from({ length: 11 }, () => ({ name: '', quantity: 0, amount: -1 })),
    }],
  }));
  assert.equal(result.ok, false);
  assert.match(result.errors.join(' '), /merchant|amount|items/);
});

test('preserves TWD and freezes its JPY conversion', () => {
  const expense = normalizeImportRow({
    date: '2026-07-14', merchant: '超商', amount: 214,
    currency: 'TWD', category: '購物', description: '點心',
    items: [], confidence: 0.8, notes: '',
  }, 21.4);
  assert.equal(expense.day, 1);
  assert.equal(expense.originalAmount, 214);
  assert.equal(expense.originalCurrency, 'TWD');
  assert.equal(expense.jpy, 1000);
  assert.equal(expense.importSource, 'chatgpt-json-v1');
});

test('normalizes duplicate comparison values', () => {
  assert.equal(
    duplicateKey({ date: '2026-07-13', merchant: ' 一蘭 ', amount: 2480, currency: 'JPY' }),
    duplicateKey({ date: '2026-07-13', merchant: '一蘭', amount: 2480, currency: 'JPY' }),
  );
  assert.match(CHATGPT_RECEIPT_PROMPT, /"version": 1/);
});
