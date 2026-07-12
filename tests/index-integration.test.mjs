import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('index loads the Firebase authentication and synchronization shell', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /firebase-family\.css/);
  assert.match(html, /firebase-family\.js/);
  assert.match(html, /firebase-bridge\.js/);
  for (const id of ['firebase-auth-gate', 'firebase-user', 'firebase-sync-status']) {
    assert.match(html, new RegExp(`id=["']${id}["']`));
  }
});

test('bundle error sink ignores opaque cross-origin script errors', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /e\.message === 'Script error\.' && !e\.error/);
});

test('bridge starts Firebase and synchronizes local application state', async () => {
  const source = await readFile('firebase-bridge.js', 'utf8');
  assert.match(source, /KyushuFamily\.start\(\)/);
  assert.match(source, /KyushuFamily\.subscribe/);
  assert.match(source, /KyushuFamily\.saveState/);
  assert.match(source, /KyushuFamily\.uploadDocument/);
  assert.match(source, /KyushuFamily\.deleteDocument/);
  assert.match(source, /kyushu-family-app-v1/);
});

test('expense UI supports one image receipt with preview, progress, and retry errors', async () => {
  const [html, app] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('src/app.jsx', 'utf8'),
  ]);
  const raw = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(raw, 'bundle template missing');
  const template = JSON.parse(raw);
  assert.match(template, /accept="image\/jpeg,image\/png,image\/webp"/);
  assert.match(template, /查看收據/);
  for (const field of ['expenseReceipt', 'expenseReceiptUrl', 'expenseSaving', 'expenseProgress', 'expenseError']) {
    assert.match(app, new RegExp(`\\b${field}\\b`));
  }
  assert.match(app, /createExpenseWithReceipt/);
  assert.match(app, /previewReceipt/);
  assert.match(app, /deleteExpenseWithReceipt/);
  assert.match(app, /URL\.createObjectURL/);
  assert.match(app, /URL\.revokeObjectURL/);
});

test('receipt picker remounts after remove and successful save so the same file can be selected again', async () => {
  const [html, app] = await Promise.all([
    readFile('index.html', 'utf8'),
    readFile('src/app.jsx', 'utf8'),
  ]);
  const raw = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  const template = JSON.parse(raw);
  assert.match(template, /key="\{\{ expenseReceiptInputKey \}\}"/);
  assert.match(app, /expenseReceiptInputKey:\s*0/);
  assert.match(app, /clearExpenseReceipt\([\s\S]*expenseReceiptInputKey:\s*s\.expenseReceiptInputKey \+ 1/);
  assert.match(app, /expenses:\s*\[\.\.\.s\.expenses, created\][\s\S]*expenseReceiptInputKey:\s*s\.expenseReceiptInputKey \+ 1/);
});

test('bundled itinerary starts with overview and keeps meeting copy with CI110', async () => {
  const html = await readFile('index.html', 'utf8');
  const raw = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(raw, 'bundle template missing');
  const template = JSON.parse(raw);
  const itinerary = template.slice(
    template.indexOf('<!-- ================= ITINERARY ================= -->'),
    template.indexOf('<!-- ================= FOOD & SHOPPING ================= -->'),
  );
  assert.match(itinerary, /\{\{ outboundMeetingTitle \}\}/);
  assert.match(itinerary, /\{\{ outboundMeetingPlace \}\}/);
  assert.match(template, /const ITINERARY_TABS = \[\s*\{ key: 'overview', label: '總覽'/);
  assert.match(itinerary, /list="\{\{ itineraryTabs \}\}"/);
  assert.doesNotMatch(itinerary.slice(itinerary.indexOf('CI111')), /集合 7\/13/);
});
