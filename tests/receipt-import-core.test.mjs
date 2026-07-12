import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHATGPT_RECEIPT_PROMPT,
  duplicateKey,
  executeImportBatch,
  normalizeImportRow,
  parseReceiptImport,
  recomputeDuplicateWarnings,
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
  const invalid = parseReceiptImport(JSON.stringify({ version: 1, expenses: [{
    date: '2026-07-18', merchant: 'x', amount: -1, currency: 'USD',
    category: 'x', description: '', items: [], confidence: 2, notes: '',
  }] })).errors.join(' ');
  assert.match(invalid, /日期/);
  assert.match(invalid, /amount/);
  assert.match(invalid, /currency/);
  assert.match(invalid, /category/);
  assert.match(invalid, /confidence/);
  assert.match(parseReceiptImport(JSON.stringify({
    version: 1, expenses: Array.from({ length: 51 }, () => validRow),
  })).errors[0], /50/);
});

test('marks duplicate rows within the imported batch and against existing expenses', () => {
  const result = parseReceiptImport(JSON.stringify({
    version: 1,
    expenses: [validRow, { ...validRow }],
  }), [{
    importDate: '2026-07-13', merchant: '一蘭拉麵', originalAmount: 2480,
    originalCurrency: 'JPY',
  }]);
  assert.equal(result.ok, true);
  assert.deepEqual(result.rows.map((row) => row.duplicate), [true, true]);

  const batchOnly = parseReceiptImport(JSON.stringify({
    version: 1,
    expenses: [validRow, { ...validRow }],
  }));
  assert.deepEqual(batchOnly.rows.map((row) => row.duplicate), [true, true]);
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

test('accepts descriptions up to 200 characters and rejects 201', () => {
  const boundary = parseReceiptImport(JSON.stringify({
    version: 1, expenses: [{ ...validRow, description: 'x'.repeat(200) }],
  }));
  assert.equal(boundary.ok, true);

  const tooLong = parseReceiptImport(JSON.stringify({
    version: 1, expenses: [{ ...validRow, description: 'x'.repeat(201) }],
  }));
  assert.equal(tooLong.ok, false);
  assert.match(tooLong.errors.join(' '), /description.*200/);
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

test('rejects non-finite, zero, and negative TWD conversion rates', () => {
  const twdRow = {
    ...validRow, currency: 'TWD', amount: 214,
  };
  for (const rate of [NaN, Infinity, -Infinity, 0, -1]) {
    assert.throws(() => normalizeImportRow(twdRow, rate), /rate.*finite positive/i);
  }
});

test('normalizes duplicate comparison values', () => {
  assert.equal(
    duplicateKey({ date: '2026-07-13', merchant: ' 一蘭 ', amount: 2480, currency: 'JPY' }),
    duplicateKey({ date: '2026-07-13', merchant: '一蘭', amount: 2480, currency: 'JPY' }),
  );
  assert.match(CHATGPT_RECEIPT_PROMPT, /"version": 1/);
});

test('recomputes duplicate warnings after edits against saved and current draft rows', () => {
  const saved = [{
    importDate: '2026-07-13', merchant: '已存商店', originalAmount: 500,
    originalCurrency: 'JPY',
  }];
  const drafts = recomputeDuplicateWarnings([
    { ...validRow, merchant: '已存商店', amount: 500 },
    { ...validRow, merchant: '唯一商店', amount: 700 },
    { ...validRow, merchant: '唯一商店', amount: 700 },
  ], saved);
  assert.deepEqual(drafts.map((row) => row.duplicate), [true, true, true]);

  const edited = recomputeDuplicateWarnings([
    drafts[0], drafts[1], { ...drafts[2], amount: 701 },
  ], []);
  assert.deepEqual(edited.map((row) => row.duplicate), [false, false, false]);
});

test('batch executor validates before making calls and preserves input on validation failure', async () => {
  let calls = 0;
  const result = await executeImportBatch({
    rows: [validRow], succeededIds: {},
    validate: () => ({ ok: false, errors: ['bad edit'] }),
    normalize: () => validRow,
    create: async () => { calls += 1; },
  });
  assert.equal(calls, 0);
  assert.deepEqual(result.errors, ['bad edit']);
  assert.equal(result.allSucceeded, false);
});

test('batch executor imports sequentially and clears only after total success', async () => {
  const events = [];
  let active = 0;
  const rows = [
    { ...validRow, importId: 'a' },
    { ...validRow, importId: 'b', merchant: '二號店' },
  ];
  const result = await executeImportBatch({
    rows, succeededIds: {}, validate: () => ({ ok: true, errors: [] }),
    normalize: (row) => row,
    create: async (row) => {
      assert.equal(active, 0, 'imports must not overlap');
      active += 1;
      events.push(`start-${row.importId}`);
      await Promise.resolve();
      events.push(`end-${row.importId}`);
      active -= 1;
      return { id: `created-${row.importId}` };
    },
  });
  assert.deepEqual(events, ['start-a', 'end-a', 'start-b', 'end-b']);
  assert.equal(result.allSucceeded, true);
  assert.deepEqual(result.createdExpenses.map((row) => row.id), ['created-a', 'created-b']);
});

test('partial retry skips successful rows and retains drafts until all rows succeed', async () => {
  const attempts = [];
  const rows = [
    { ...validRow, importId: 'a' },
    { ...validRow, importId: 'b', merchant: '二號店' },
  ];
  const first = await executeImportBatch({
    rows, succeededIds: {}, validate: () => ({ ok: true, errors: [] }), normalize: (row) => row,
    create: async (row) => {
      attempts.push(row.importId);
      if (row.importId === 'b') throw new Error('offline');
      return { id: row.importId };
    },
  });
  assert.equal(first.allSucceeded, false);
  assert.deepEqual(first.succeededIds, { a: true });
  assert.deepEqual(first.errors, ['第 2 筆：offline']);

  const second = await executeImportBatch({
    rows, succeededIds: first.succeededIds,
    validate: () => ({ ok: true, errors: [] }), normalize: (row) => row,
    create: async (row) => { attempts.push(row.importId); return { id: row.importId }; },
  });
  assert.deepEqual(attempts, ['a', 'b', 'b']);
  assert.equal(second.allSucceeded, true);
  assert.deepEqual(second.createdExpenses, [{ id: 'b' }]);
});
