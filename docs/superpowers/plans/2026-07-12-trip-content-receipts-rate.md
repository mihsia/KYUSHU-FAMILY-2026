# 九州親子遊行程、收據與匯率改版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在既有九州親子遊網站中完成去程集合修正、五日行程總覽與擴寫、首頁排序、臺銀手動匯率同步，以及每筆記帳一張收據的 Firebase 多人功能。

**Architecture:** 保留現有 React/Babel 單頁應用、GitHub Pages、Firebase Authentication、Firestore 與 Storage。先把 `index.html` 內壓縮的應用程式資產抽成可維護的 `src/app.jsx`，再以 Node 內建模組確定性重建封裝；畫面狀態仍由現有 localStorage bridge 同步，但收據採明確的 Firebase service API，確保「先上傳、後寫入」與成對刪除。

**Tech Stack:** HTML/CSS、React class component、Babel Standalone、Node.js `node:test`、Firebase Web SDK 12.15.0、Firestore、Firebase Storage、GitHub Pages。

## Global Constraints

- 保留現有視覺語言、Google 登入、兩位白名單成員同步與 GitHub Pages 發布方式。
- 不重建前端框架，不新增 npm runtime dependency，不使用 Firebase Blaze、Cloud Functions、OCR 或 AI 自動分類。
- 行程預設頁為「總覽」，底部順序固定為 `總覽｜7/13｜7/14｜7/15｜7/16｜7/17`。
- 首頁順序固定為：行程、匯率換算、美食購物指南、願望清單、必買清單、行李清單、記帳、文件、備忘資訊。
- 匯率來源固定為 `BOT cash sell`，官方網址固定為 `https://rate.bot.com.tw/xrt?Lang=zh-TW`，只支援手動更新與雲端同步。
- 每筆記帳最多一張 JPEG、PNG 或 WebP 收據，檔案必須大於 0 且不超過 10 MB。
- 收據路徑固定為 `trips/kyushu-2026/receipts/{expenseId}/{safeFileName}`。
- 收據四欄 `receiptPath`、`receiptName`、`receiptType`、`receiptSize` 必須同時存在或同時省略。
- 不提交工作區內既有未追蹤 PDF 或 `九州親子遊App-standalone.html`。

---

## File Structure

- Create: `src/app.jsx` — 封裝前 React 應用的唯一可編輯來源。
- Create: `scripts/extract-app-source.mjs` — 從現有 bundle 一次性抽出 app JSX。
- Create: `scripts/build-app-bundle.mjs` — 將 `src/app.jsx` 壓回既有 bundle manifest 並更新 `index.html`。
- Modify: `index.html` — 建置產物與 Firebase shell 入口。
- Modify: `firebase-family-core.js` — 收據驗證、匯率與舊狀態正規化的純函式。
- Modify: `firebase-family.js` — Firestore/Storage 的匯率、收據新增、預覽、刪除 API。
- Modify: `firebase-bridge.js` — 雲端狀態套用與避免 generic expense sync 破壞收據欄位。
- Modify: `firebase-family.css` — 登入列與收據上傳狀態的補充樣式。
- Modify: `firestore.rules` — 匯率 metadata 與 optional receipt schema。
- Modify: `storage.rules` — receipts 白名單、圖片類型與 10 MB 限制。
- Modify: `tests/app-source-contract.test.mjs` — 行程、文案、首頁順序與 bundle 一致性。
- Modify: `tests/firebase-family-core.test.mjs` — 純函式與資料正規化。
- Modify: `tests/firebase-browser-contract.test.mjs` — Firebase public API 與順序契約。
- Modify: `tests/index-integration.test.mjs` — 正式 bundle 與 bridge 整合。
- Modify: `tests/rules-contract.test.mjs` — Firestore/Storage 規則契約。

### Task 1: 建立可重複建置的 App 來源

**Files:**
- Create: `scripts/extract-app-source.mjs`
- Create: `scripts/build-app-bundle.mjs`
- Create: `src/app.jsx`
- Create: `tests/app-source-contract.test.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `index.html` 內 `script[type="__bundler/manifest"]` JSON，應用資產以內容包含 `const DAYS = [` 與 `class Component extends DCLogic` 識別。
- Produces: `src/app.jsx`；`node scripts/build-app-bundle.mjs` 必須只更新相同 manifest entry 並保持其他資產不變。

- [ ] **Step 1: 寫出會失敗的來源／bundle 契約測試**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

test('editable app source exists and matches the bundled app asset', async () => {
  const source = await readFile('src/app.jsx', 'utf8');
  const html = await readFile('index.html', 'utf8');
  const raw = html.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(raw, 'bundle manifest missing');
  const assets = Object.values(JSON.parse(raw));
  const decoded = assets.map((entry) => {
    const bytes = Buffer.from(entry.data, 'base64');
    return entry.compressed ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
  });
  assert.equal(decoded.filter((text) => text.includes('class Component extends DCLogic')).length, 1);
  assert.ok(decoded.includes(source));
});
```

- [ ] **Step 2: 執行測試並確認缺少來源檔**

Run: `node --test tests/app-source-contract.test.mjs`

Expected: FAIL with `ENOENT: no such file or directory, open 'src/app.jsx'`。

- [ ] **Step 3: 實作抽取腳本**

```js
// scripts/extract-app-source.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';

const html = await readFile('index.html', 'utf8');
const match = html.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error('bundle manifest missing');
const manifest = JSON.parse(match[1]);
const candidates = Object.values(manifest).map((entry) => {
  const bytes = Buffer.from(entry.data, 'base64');
  return entry.compressed ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
}).filter((text) => text.includes('const DAYS = [') && text.includes('class Component extends DCLogic'));
if (candidates.length !== 1) throw new Error(`expected one app asset, found ${candidates.length}`);
await mkdir('src', { recursive: true });
await writeFile('src/app.jsx', candidates[0]);
```

- [ ] **Step 4: 執行抽取並實作確定性建置腳本**

```js
// scripts/build-app-bundle.mjs
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync, gzipSync } from 'node:zlib';

const [html, source] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/app.jsx', 'utf8'),
]);
const match = html.match(/<script type="__bundler\/manifest">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error('bundle manifest missing');
const manifest = JSON.parse(match[1]);
const id = Object.entries(manifest).find(([, entry]) => {
  const bytes = Buffer.from(entry.data, 'base64');
  const text = entry.compressed ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
  return text.includes('class Component extends DCLogic');
})?.[0];
if (!id) throw new Error('app asset missing');
manifest[id] = {
  ...manifest[id],
  compressed: true,
  data: gzipSync(Buffer.from(source), { level: 9, mtime: 0 }).toString('base64'),
};
const replacement = `<script type="__bundler/manifest">\n${JSON.stringify(manifest)}\n  </script>`;
await writeFile('index.html', html.slice(0, match.index) + replacement + html.slice(match.index + match[0].length));
```

Run: `node scripts/extract-app-source.mjs && node scripts/build-app-bundle.mjs && node --test tests/app-source-contract.test.mjs`

Expected: PASS；第二次執行 `node scripts/build-app-bundle.mjs` 後 `git diff --exit-code -- index.html` 也應 PASS。

- [ ] **Step 5: 提交來源管線**

```bash
git add src/app.jsx scripts/extract-app-source.mjs scripts/build-app-bundle.mjs tests/app-source-contract.test.mjs .gitignore index.html
git commit -m "build: make bundled trip app editable"
```

### Task 2: 修正航班、加入總覽並擴寫五日行程

**Files:**
- Modify: `src/app.jsx`
- Modify: `tests/app-source-contract.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Consumes: Task 1 的 `src/app.jsx` 與 `node scripts/build-app-bundle.mjs`。
- Produces: `ITINERARY_TABS`、擴寫後 `DAYS`，以及 `itineraryTab: 'overview' | 0 | 1 | 2 | 3 | 4`。

- [ ] **Step 1: 增加行程內容契約測試**

```js
test('trip source contains approved flight copy, overview, and five-day guide content', async () => {
  const source = await readFile('src/app.jsx', 'utf8');
  for (const text of [
    '去程集合｜7/13（一）凌晨 04:20',
    '桃園機場第二航廈・華航 7 號櫃台',
    "key: 'overview', label: '總覽'",
    '長崎海風與企鵝的夏日序曲',
    '穿越有明海，遇見萌熊列車',
    '由布院之森，開往森林深處的列車',
    '野生動物、學問之神與福岡購物',
    '帶著九州夏日記憶返程',
    '今日看點', '今日任務', '本日三必', '旅行提醒', '行程異動',
  ]) assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});
```

- [ ] **Step 2: 執行測試確認新文案尚不存在**

Run: `node --test tests/app-source-contract.test.mjs`

Expected: FAIL at `去程集合｜7/13（一）凌晨 04:20` 或 `key: 'overview'`。

- [ ] **Step 3: 擴充資料模型與預設狀態**

```jsx
const ITINERARY_TABS = [
  { key: 'overview', label: '總覽', color: '#111111' },
  ...DAYS.map((day) => ({ key: day.id, label: day.date, color: day.color })),
];

// constructor state
itineraryTab: 'overview',
```

每個 `DAYS` item 必須新增完整的 `highlights: string[]`、`missions: string[]`、`mustSee: string[]`、`mustEat: string[]`、`mustBuy: string[]`、`familyPrompt: string`、`changeNotice: string | null` 與 `hotel: { name, note, address, phone } | null`；值逐字依核准規格第 6.1–6.5 節填入，不得使用空陣列代替已指定內容。

- [ ] **Step 4: 實作總覽、六格導覽與去程卡片文案**

```jsx
const itineraryTabs = ITINERARY_TABS.map((tab) => ({
  label: tab.label,
  onClick: () => this.setState({ itineraryTab: tab.key }),
  bg: this.state.itineraryTab === tab.key ? tab.color : '#16323a',
  color: this.state.itineraryTab === tab.key ? '#fff' : '#b9ddd6',
}));
const showOverview = this.state.itineraryTab === 'overview';
const currentDay = showOverview ? null : DAYS[this.state.itineraryTab];
const overviewDays = DAYS.map((day) => ({
  ...day,
  onOpen: () => this.setState({ itineraryTab: day.id }),
  summary: day.activities.map((item) => item.title).join('・'),
}));
```

在航班卡 CI110 區塊內放入兩行：`去程集合｜7/13（一）凌晨 04:20` 與 `桃園機場第二航廈・華航 7 號櫃台`；CI111 區塊後不得再出現泛稱「集合」的一行。總覽使用五日垂直時間軸；日期頁依序渲染時間軸、今日看點、今日任務、本日三必、親子問答／旅行提醒、條件式行程異動與今晚住宿。

- [ ] **Step 5: 建置並跑行程契約測試**

Run: `node scripts/build-app-bundle.mjs && node --test tests/app-source-contract.test.mjs tests/index-integration.test.mjs`

Expected: all tests PASS；`index.html` 解壓後包含核准集合文案且 `總覽` 先於 `7/13`。

- [ ] **Step 6: 提交行程改版**

```bash
git add src/app.jsx index.html tests/app-source-contract.test.mjs
git commit -m "feat: expand five-day itinerary overview"
```

### Task 3: 首頁排序與臺銀手動匯率同步

**Files:**
- Modify: `src/app.jsx`
- Modify: `firebase-family-core.js`
- Modify: `firebase-family.js`
- Modify: `firebase-bridge.js`
- Modify: `firestore.rules`
- Modify: `tests/firebase-family-core.test.mjs`
- Modify: `tests/firebase-browser-contract.test.mjs`
- Modify: `tests/rules-contract.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Produces: root trip fields `rate: number`, `rateSource: 'BOT cash sell'`, `rateUpdatedAt`, `rateUpdatedBy`；UI local state `rateMeta`。
- Consumes: `saveState(input)`，其中 `input.rate` 是「每 100 日圓的新臺幣數」；UI 顯示每 1 日圓時使用 `rate / 100`。

- [ ] **Step 1: 寫匯率正規化與契約測試**

```js
test('normalizes BOT rate metadata with a safe fallback', () => {
  const result = normalizeLegacyStore({ rate: 21.4, rateSource: 'BOT cash sell', rateUpdatedBy: 'u1' });
  assert.equal(result.rate, 21.4);
  assert.equal(result.rateSource, 'BOT cash sell');
  assert.equal(result.rateUpdatedBy, 'u1');
});

test('browser service persists BOT rate audit fields', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  assert.match(source, /rateSource:\s*'BOT cash sell'/);
  assert.match(source, /rateUpdatedAt:\s*serverTimestamp\(\)/);
  assert.match(source, /rateUpdatedBy:\s*currentUser\.uid/);
});
```

- [ ] **Step 2: 執行測試確認 metadata 尚未實作**

Run: `node --test tests/firebase-family-core.test.mjs tests/firebase-browser-contract.test.mjs`

Expected: FAIL because `rateSource` and audit fields are absent。

- [ ] **Step 3: 實作 core、Firestore snapshot 與 save metadata**

```js
// normalizeLegacyStore return value
rate: Number.isFinite(Number(source.rate)) ? Number(source.rate) : 21.4,
rateSource: source.rateSource === 'BOT cash sell' ? source.rateSource : 'BOT cash sell',
rateUpdatedAt: source.rateUpdatedAt || null,
rateUpdatedBy: String(source.rateUpdatedBy || ''),
```

```js
// saveState root write
await setDoc(tripRef(), {
  rate: state.rate,
  rateSource: 'BOT cash sell',
  rateUpdatedAt: serverTimestamp(),
  rateUpdatedBy: currentUser.uid,
  updatedAt: serverTimestamp(),
}, { merge: true });
```

root snapshot 同步讀取四欄，bridge 將四欄寫回 localStorage；舊資料沒有 metadata 時保留 `rate` 並顯示「尚無更新紀錄」。

- [ ] **Step 4: 更新 Firestore root schema**

```rules
data.keys().hasOnly([
  'rate', 'rateSource', 'rateUpdatedAt', 'rateUpdatedBy',
  'initialized', 'initializedBy', 'initializedAt', 'updatedAt'
])
&& data.rate is number && data.rate > 0 && data.rate <= 100
&& data.rateSource == 'BOT cash sell'
&& data.rateUpdatedAt is timestamp
&& data.rateUpdatedBy is string && data.rateUpdatedBy.size() > 0 && data.rateUpdatedBy.size() <= 128
```

- [ ] **Step 5: 重排首頁並完成匯率 UI**

首頁九張卡片依 Global Constraints 順序重新編號，第二張綁定 `openConverter`。匯率頁加入：

```jsx
<a href="https://rate.bot.com.tw/xrt?Lang=zh-TW" target="_blank" rel="noopener noreferrer">
  查看臺銀最新牌價
</a>
<p>臺灣銀行日圓現金賣出價</p>
<p>{`1 日圓 ≈ ${(this.state.rate / 100).toFixed(4)} 新臺幣`}</p>
<p>{rateUpdatedLabel}</p>
<p>牌價僅供參考，實際交易以交易當下為準</p>
```

只有合法正數才保存；雙向換算沿用 `JPY × rate / 100 = TWD`。

- [ ] **Step 6: 執行測試並提交**

Run: `node scripts/build-app-bundle.mjs && node --test tests/*.mjs`

Expected: all tests PASS。

```bash
git add src/app.jsx index.html firebase-family-core.js firebase-family.js firebase-bridge.js firestore.rules tests
git commit -m "feat: sync Bank of Taiwan cash selling rate"
```

### Task 4: 收據資料驗證與 Firebase 安全規則

**Files:**
- Modify: `firebase-family-core.js`
- Modify: `firestore.rules`
- Modify: `storage.rules`
- Modify: `tests/firebase-family-core.test.mjs`
- Modify: `tests/rules-contract.test.mjs`

**Interfaces:**
- Produces: `validateReceipt(file): { ok: true } | { ok: false, error: string }`、Firestore optional receipt tuple、Storage receipts path。
- Consumes: `MAX_FILE_SIZE` 與 `sanitizeFileName(name)`。

- [ ] **Step 1: 寫收據限制測試**

```js
test('receipt validation accepts only non-empty JPEG PNG or WebP up to 10 MB', () => {
  assert.deepEqual(validateReceipt({ size: 1, type: 'image/jpeg' }), { ok: true });
  assert.deepEqual(validateReceipt({ size: MAX_FILE_SIZE, type: 'image/webp' }), { ok: true });
  assert.deepEqual(validateReceipt({ size: 0, type: 'image/png' }), { ok: false, error: '收據檔案不可為空' });
  assert.deepEqual(validateReceipt({ size: 4, type: 'application/pdf' }), { ok: false, error: '收據只允許 JPEG、PNG 或 WebP' });
  assert.deepEqual(validateReceipt({ size: MAX_FILE_SIZE + 1, type: 'image/png' }), { ok: false, error: '收據超過 10 MB' });
});
```

- [ ] **Step 2: 執行測試確認 `validateReceipt` 尚不存在**

Run: `node --test tests/firebase-family-core.test.mjs`

Expected: FAIL with missing export `validateReceipt`。

- [ ] **Step 3: 實作純函式**

```js
const RECEIPT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export function validateReceipt(file) {
  if (!file || Number(file.size) <= 0) return { ok: false, error: '收據檔案不可為空' };
  if (Number(file.size) > MAX_FILE_SIZE) return { ok: false, error: '收據超過 10 MB' };
  if (!RECEIPT_TYPES.has(String(file.type || '').toLowerCase())) {
    return { ok: false, error: '收據只允許 JPEG、PNG 或 WebP' };
  }
  return { ok: true };
}
```

- [ ] **Step 4: 更新 Firestore 收據欄位原子 schema**

```rules
function hasNoReceipt(data) {
  return !data.keys().hasAny(['receiptPath', 'receiptName', 'receiptType', 'receiptSize']);
}
function hasValidReceipt(data, expenseId) {
  return data.keys().hasAll(['receiptPath', 'receiptName', 'receiptType', 'receiptSize'])
    && data.receiptPath.matches('^trips/kyushu-2026/receipts/' + expenseId + '/[^/]+$')
    && data.receiptName is string && data.receiptName.size() > 0 && data.receiptName.size() <= 240
    && data.receiptType.matches('^image/(jpeg|png|webp)$')
    && data.receiptSize is int && data.receiptSize > 0 && data.receiptSize <= 10 * 1024 * 1024;
}
```

`isValidExpense(data, expenseId)` 的 `hasOnly` 加入四欄，末尾要求 `(hasNoReceipt(data) || hasValidReceipt(data, expenseId))`。

- [ ] **Step 5: 更新 Storage receipts 規則與契約測試**

```rules
match /trips/kyushu-2026/receipts/{expenseId}/{fileName} {
  allow read, delete: if isAllowed();
  allow create, update: if isAllowed()
    && request.resource.size > 0
    && request.resource.size <= 10 * 1024 * 1024
    && request.resource.contentType.matches('image/(jpeg|png|webp)');
}
```

Run: `node --test tests/firebase-family-core.test.mjs tests/rules-contract.test.mjs`

Expected: all tests PASS，且 rules contract 確認 receipts 路徑、三種圖片 MIME、10 MB 與兩位白名單仍存在。

- [ ] **Step 6: 提交 schema 與規則**

```bash
git add firebase-family-core.js firestore.rules storage.rules tests/firebase-family-core.test.mjs tests/rules-contract.test.mjs
git commit -m "feat: secure one receipt per expense"
```

### Task 5: 實作收據上傳、預覽、刪除與失敗補償

**Files:**
- Modify: `firebase-family.js`
- Modify: `firebase-bridge.js`
- Modify: `src/app.jsx`
- Modify: `firebase-family.css`
- Modify: `tests/firebase-browser-contract.test.mjs`
- Modify: `tests/index-integration.test.mjs`
- Modify: `index.html`

**Interfaces:**
- Produces: `createExpenseWithReceipt(expense, file?, onProgress?)`、`previewReceipt(expense)`、`deleteExpenseWithReceipt(expense)`。
- Consumes: expense shape `{ id?, day, category, note, jpy }` 與 optional receipt `File`。

- [ ] **Step 1: 寫 public API 與操作順序契約測試**

```js
test('browser service exposes receipt-aware expense operations', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  for (const name of ['createExpenseWithReceipt', 'previewReceipt', 'deleteExpenseWithReceipt']) {
    assert.match(source, new RegExp(`\\b${name}\\b`));
  }
  const createBody = source.match(/async function createExpenseWithReceipt[\s\S]*?\n}/)?.[0] || '';
  assert.ok(createBody.indexOf('uploadBytesResumable') < createBody.indexOf('setDoc(expenseRef'));
  assert.match(createBody, /deleteObject[\s\S]*catch/);
});
```

- [ ] **Step 2: 執行測試確認 API 尚不存在**

Run: `node --test tests/firebase-browser-contract.test.mjs`

Expected: FAIL at `createExpenseWithReceipt`。

- [ ] **Step 3: 實作 Firebase service**

```js
async function createExpenseWithReceipt(expense, file = null, onProgress = () => {}) {
  if (!currentUser) throw new Error('請先登入');
  const expenseRef = expense.id
    ? doc(tripCollection('expenses'), String(expense.id))
    : doc(tripCollection('expenses'));
  let receipt = {};
  let objectRef = null;
  if (file) {
    const validation = validateReceipt(file);
    if (!validation.ok) throw new Error(validation.error);
    const path = `trips/${TRIP_ID}/receipts/${expenseRef.id}/${sanitizeFileName(file.name)}`;
    objectRef = ref(storage, path);
    const task = uploadBytesResumable(objectRef, file, { contentType: file.type });
    await new Promise((resolve, reject) => task.on('state_changed',
      (snap) => onProgress(Math.round(snap.bytesTransferred / snap.totalBytes * 100)), reject, resolve));
    receipt = { receiptPath: path, receiptName: file.name, receiptType: file.type, receiptSize: file.size };
  }
  try {
    await setDoc(expenseRef, withCreation({ ...expenseItem(expense), ...receipt }));
  } catch (error) {
    if (objectRef) await deleteObject(objectRef).catch(() => {});
    throw error;
  }
  return { id: expenseRef.id, ...expense, ...receipt };
}
```

`expenseItem()` 必須保留已存在的四個 receipt fields；`previewReceipt()` 以 `getDownloadURL` 開新頁；`deleteExpenseWithReceipt()` 先刪 Storage，再刪 Firestore。Storage 刪除失敗時不得刪 Firestore，應拋錯讓 UI 顯示「收據刪除失敗，請重試」。

- [ ] **Step 4: 避免 generic collection sync 覆蓋收據欄位**

將 `saveState()` 的 `syncCollection('expenses', ...)` 移除。新增／刪除記帳只走 Task 5 的明確 API；Firestore snapshot 仍把完整 expense objects 放入 `cloud.expenses`。bridge 不再從 localStorage diff 批次刪除 expenses。

- [ ] **Step 5: 實作記帳表單的一張收據互動**

在 component state 加入：

```jsx
expenseReceipt: null,
expenseReceiptUrl: '',
expenseSaving: false,
expenseProgress: 0,
expenseError: '',
```

檔案選擇後先呼叫 `validateReceipt(file)` 等價限制並以 `URL.createObjectURL(file)` 顯示縮圖；更換前 `URL.revokeObjectURL(oldUrl)`；移除只清表單，不觸發雲端刪除。儲存按鈕直接呼叫 `window.KyushuFamily.createExpenseWithReceipt(...)`，成功後清空表單，失敗時保留所有欄位、預覽與錯誤訊息。

每筆 expense 若有 `receiptPath`，顯示「查看收據」並綁定 `previewReceipt(expense)`；刪除綁定 `deleteExpenseWithReceipt(expense)`，失敗時保留列表項目並顯示重試訊息。

- [ ] **Step 6: 建置並跑完整測試**

Run: `node scripts/build-app-bundle.mjs && node --test tests/*.mjs`

Expected: all tests PASS；contract 確認 PDF 不被 receipt picker 接受，且 public API 全部由 `window.KyushuFamily` 匯出。

- [ ] **Step 7: 提交收據功能**

```bash
git add firebase-family.js firebase-bridge.js firebase-family.css src/app.jsx index.html tests
git commit -m "feat: attach receipts to shared expenses"
```

### Task 6: 全面驗證、安全規則部署與 GitHub Pages 發布

**Files:**
- Modify if verification finds defects: only files already listed in Tasks 1–5
- Verify: `firebase.json`, `.firebaserc`, generated `index.html`

**Interfaces:**
- Consumes: Tasks 1–5 的全部產物。
- Produces: 通過測試的 main branch、已部署 Firestore/Storage rules、GitHub Pages `built` 狀態。

- [ ] **Step 1: 執行靜態與自動測試**

Run:

```bash
node scripts/build-app-bundle.mjs
node --test tests/*.mjs
git diff --check
git status --short
```

Expected: all tests PASS；`git diff --check` 無輸出；status 只列出本次追蹤修改與原有未追蹤 PDF/standalone HTML，後者不加入 commit。

- [ ] **Step 2: 啟動本機網站並做桌面驗收**

Run: `/Users/eric/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 8765`

以已登入瀏覽器檢查：首頁九卡順序；匯率頁官方連結、手動保存與雙向換算；行程預設總覽、六格 tab、D1–D5 詳細區塊；去程集合位於 CI110 卡內；記帳無收據與有收據各建立一筆、預覽後刪除。

Expected: 無空白頁、遮擋、裁切、水平捲動或 console error。

- [ ] **Step 3: 做手機寬度驗收**

Viewport: `390 × 844`。

Expected: 六個行程 tab 同列等分；總覽時間軸與所有卡片不超出 viewport；收據縮圖、更換、移除、儲存與錯誤文案可操作；固定導覽不遮住最後一筆內容。

- [ ] **Step 4: 以兩個白名單帳號驗收同步**

帳號 A 更新臺銀匯率並新增有收據記帳；帳號 B 重新開啟網站。

Expected: B 看見相同 `rate`、`BOT cash sell`、更新時間、更新者與收據；未登入／非白名單帳號不能讀取收據 URL。

- [ ] **Step 5: 部署 Firebase rules**

Run: `npx -y firebase-tools@latest deploy --only firestore:rules,storage --project kyushu-family-2026`

Expected: `Deploy complete!`，Firestore Rules 與 Storage Rules 均成功發布。

- [ ] **Step 6: 最終提交並推送 GitHub**

```bash
git add index.html src scripts firebase-family-core.js firebase-family.js firebase-bridge.js firebase-family.css firestore.rules storage.rules tests docs/superpowers/plans/2026-07-12-trip-content-receipts-rate.md
git commit -m "test: verify trip app enhancements"
git push origin main
```

如果沒有未提交變更，略過空 commit，只執行 push。絕對不要 `git add` 五個未追蹤 PDF 或 `九州親子遊App-standalone.html`。

- [ ] **Step 7: 驗證 GitHub Pages**

Run: `/opt/homebrew/bin/gh api repos/mihsia/KYUSHU-FAMILY-2026/pages/builds/latest`

Expected: response `status` 為 `built`，`commit` 對應剛推送的 main SHA；最後以 `https://mihsia.github.io/KYUSHU-FAMILY-2026/` 重做航班、總覽、匯率與收據 smoke test。

