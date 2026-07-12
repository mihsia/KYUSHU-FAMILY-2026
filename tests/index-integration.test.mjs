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

test('generated browser head loads the receipt import core module', async () => {
  const html = await readFile('index.html', 'utf8');
  const head = html.match(/<head>[\s\S]*?<\/head>/)?.[0] || '';
  assert.match(head, /<script type="module" src="receipt-import-core\.js"><\/script>/);
});

test('website exposes Apple and PWA install metadata in both heads', async () => {
  const html = await readFile('index.html', 'utf8');
  const raw = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(raw, 'bundle template missing');
  const inner = JSON.parse(raw);
  for (const source of [html, inner]) {
    assert.match(source, /rel="apple-touch-icon"[^>]*apple-touch-icon\.png/);
    assert.match(source, /rel="manifest"[^>]*manifest\.webmanifest/);
    assert.match(source, /apple-mobile-web-app-title" content="九州親子遊"/);
    assert.match(source, /theme-color" content="#12363D"/);
  }
});

test('web manifest uses the GitHub Pages subpath and required icons', async () => {
  const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.short_name, '九州親子遊');
  assert.equal(manifest.start_url, '/KYUSHU-FAMILY-2026/');
  assert.equal(manifest.scope, '/KYUSHU-FAMILY-2026/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.icons.map(({ src, sizes }) => [src, sizes]), [
    ['icon-192.png', '192x192'],
    ['icon-512.png', '512x512'],
  ]);
});

test('bundle error sink ignores opaque cross-origin script errors', async () => {
  const html = await readFile('index.html', 'utf8');
  assert.match(html, /e\.message === 'Script error\.' && !e\.error/);
});

test('bridge starts Firebase and synchronizes local application state', async () => {
  const [source, app] = await Promise.all([
    readFile('firebase-bridge.js', 'utf8'),
    readFile('src/app.jsx', 'utf8'),
  ]);
  assert.match(source, /KyushuFamily\.start\(\)/);
  assert.match(source, /KyushuFamily\.subscribe/);
  assert.match(source, /KyushuFamily\.saveState/);
  assert.doesNotMatch(source, /syncDocumentChanges|fetch\(file\.dataUrl\)/);
  assert.doesNotMatch(source, /window\.location\.reload/);
  assert.match(source, /kyushu-family-cloud-state/);
  assert.match(app, /addEventListener\('kyushu-family-cloud-state'/);
  assert.match(app, /removeEventListener\('kyushu-family-cloud-state'/);
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

test('expense UI exposes ChatGPT JSON review and retry flow', async () => {
  const [html, app] = await Promise.all([
    readFile('index.html', 'utf8'), readFile('src/app.jsx', 'utf8'),
  ]);
  const template = JSON.parse(html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
  assert.match(template, /匯入 ChatGPT 辨識結果/);
  assert.match(template, /複製 ChatGPT 提示詞/);
  assert.match(template, /檢查資料/);
  assert.match(template, /確認匯入/);
  assert.match(template, /移除此筆/);
  assert.match(template, /type="date" min="2026-07-13" max="2026-07-17"/);
  assert.match(template, /type="number" min="1" max="10000000"/);
  assert.match(app, /parseReceiptImport/);
  assert.match(app, /normalizeImportRow/);
  assert.match(app, /createImportedExpense/);
  assert.match(app, /importSucceededIds/);
  assert.match(app, /recomputeDuplicateWarnings/);
  assert.match(app, /executeImportBatch/);
  assert.match(app, /removeImportDraft/);
  assert.match(app, /onRemove/);
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
