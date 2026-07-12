# Document Preview and ChatGPT Receipt Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Firebase document/receipt previews on iPhone Safari and add a validated, editable ChatGPT JSON expense import flow that safely persists to Firestore.

**Architecture:** Keep Firebase download URL lookup in `firebase-family.js`, but navigate the current page instead of opening an asynchronous popup. Put receipt JSON parsing, normalization, currency conversion, and duplicate detection in a new pure module so browser UI and tests share one contract; the React app owns draft editing and calls one Firebase write per confirmed row so partial failures can be retried.

**Tech Stack:** React 18 class component, browser ES modules, Firebase Auth/Firestore/Storage Web SDK, Firebase Security Rules, Node.js built-in test runner, repository bundle script.

## Global Constraints

- The site remains a static GitHub Pages app; no OpenAI API key or ChatGPT account data may be stored in the client.
- ChatGPT input contract version is numeric `1`; a batch contains at most 50 expenses.
- Supported currencies are exactly `JPY` and `TWD`.
- Supported categories are exactly `餐飲`, `交通`, `住宿`, `購物`, `門票`, and `其他`.
- Trip dates are 2026-07-13 through 2026-07-17, mapped to `day` 0 through 4; out-of-range or blank dates block import.
- TWD is converted at confirmation time with the current `rate` expressed as TWD per 100 JPY; old expenses are never recalculated.
- Preview uses current-page navigation, with browser Back returning to the app.
- Existing untracked travel PDFs and standalone HTML files must not be added, modified, or removed.

---

### Task 1: Pure ChatGPT receipt import contract

**Files:**
- Create: `receipt-import-core.js`
- Create: `tests/receipt-import-core.test.mjs`

**Interfaces:**
- Consumes: JSON text, current rate, and existing expense objects.
- Produces: `CHATGPT_RECEIPT_PROMPT: string`, `parseReceiptImport(text): { ok, rows, errors }`, `normalizeImportRow(row, rate): expense`, and `duplicateKey(row): string`.

- [ ] **Step 1: Write failing parser and validation tests**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHATGPT_RECEIPT_PROMPT,
  duplicateKey,
  normalizeImportRow,
  parseReceiptImport,
} from '../receipt-import-core.js';

const valid = JSON.stringify({
  version: 1,
  expenses: [{
    date: '2026-07-13', merchant: '一蘭拉麵', amount: 2480,
    currency: 'JPY', category: '餐飲', description: '晚餐',
    items: [{ name: '拉麵', quantity: 2, amount: 1960 }],
    confidence: 0.96, notes: '',
  }],
});

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
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `node --test tests/receipt-import-core.test.mjs`
Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `receipt-import-core.js`.

- [ ] **Step 3: Implement the pure contract**

```js
export const IMPORT_CATEGORIES = Object.freeze(['餐飲', '交通', '住宿', '購物', '門票', '其他']);
const DATE_TO_DAY = Object.freeze({
  '2026-07-13': 0, '2026-07-14': 1, '2026-07-15': 2,
  '2026-07-16': 3, '2026-07-17': 4,
});

export const CHATGPT_RECEIPT_PROMPT = `請辨識我上傳的所有收據，並且只輸出 JSON，不要加入 Markdown、程式碼框、解釋或其他文字。
輸出 {"version":1,"expenses":[...]}；date 用 YYYY-MM-DD；amount 用數字；currency 只能是 JPY 或 TWD；category 只能是餐飲、交通、住宿、購物、門票、其他；每筆包含 date、merchant、amount、currency、category、description、items、confidence、notes。`;

export function duplicateKey(row) {
  return [row.date, String(row.merchant || '').trim().toLocaleLowerCase(),
    Number(row.amount), row.currency].join('|');
}

export function normalizeImportRow(row, rate) {
  const originalAmount = Number(row.amount);
  const jpy = row.currency === 'JPY'
    ? originalAmount
    : Math.round(originalAmount * 100 / Number(rate));
  return {
    day: DATE_TO_DAY[row.date], category: row.category,
    note: String(row.description || row.merchant).trim(), jpy,
    originalAmount, originalCurrency: row.currency,
    importSource: 'chatgpt-json-v1', merchant: String(row.merchant).trim(),
    items: row.items.map(({ name, quantity, amount }) => ({
      name: String(name).trim(), quantity: Number(quantity), amount: Number(amount),
    })),
    confidence: Number(row.confidence), importNotes: String(row.notes || '').trim(),
    importDate: row.date,
  };
}
```

Complete `parseReceiptImport` with strict JSON parsing, exact version checking, 1–50 batch size, per-row error paths such as `第 2 筆 currency`, string length limits, finite positive amounts, item limits, and the date map above. Return no normalized rows when any blocking error exists.

- [ ] **Step 4: Run the focused and full core tests**

Run: `node --test tests/receipt-import-core.test.mjs tests/firebase-family-core.test.mjs`
Expected: all tests PASS.

- [ ] **Step 5: Commit the pure contract**

```bash
git add receipt-import-core.js tests/receipt-import-core.test.mjs
git commit -m "feat: validate ChatGPT receipt imports"
```

---

### Task 2: Current-page Firebase previews

**Files:**
- Modify: `firebase-family.js:291-295,345-348`
- Modify: `tests/firebase-browser-contract.test.mjs`

**Interfaces:**
- Consumes: an expense with `receiptPath` or document with `storagePath`.
- Produces: `previewReceipt(expense): Promise<void>` and `previewDocument(documentData): Promise<void>` that navigate the current page.

- [ ] **Step 1: Add a failing popup-regression test**

```js
test('Firebase previews navigate the current page instead of opening async popups', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  const receipt = source.match(/async function previewReceipt[\s\S]*?\n}/)?.[0] || '';
  const document = source.match(/async function previewDocument[\s\S]*?\n}/)?.[0] || '';
  for (const body of [receipt, document]) {
    assert.match(body, /window\.location\.assign\(url\)/);
    assert.doesNotMatch(body, /window\.open/);
  }
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/firebase-browser-contract.test.mjs`
Expected: FAIL because both functions still contain `window.open`.

- [ ] **Step 3: Replace popup opening with same-page navigation**

```js
async function previewReceipt(expense) {
  if (!expense.receiptPath) throw new Error('此筆記帳沒有收據');
  const url = await getDownloadURL(ref(storage, expense.receiptPath));
  window.location.assign(url);
}

async function previewDocument(documentData) {
  if (!documentData?.storagePath) throw new Error('文件資料不完整');
  const url = await getDownloadURL(ref(storage, documentData.storagePath));
  window.location.assign(url);
}
```

- [ ] **Step 4: Run browser contract tests**

Run: `node --test tests/firebase-browser-contract.test.mjs`
Expected: all tests PASS.

- [ ] **Step 5: Commit preview repair**

```bash
git add firebase-family.js tests/firebase-browser-contract.test.mjs
git commit -m "fix: open Firebase previews in current page"
```

---

### Task 3: Firestore expense model and import write API

**Files:**
- Modify: `firebase-family.js:111-124,263-289,413-423`
- Modify: `tests/firebase-browser-contract.test.mjs`

**Interfaces:**
- Consumes: normalized expenses from `normalizeImportRow`.
- Produces: `createImportedExpense(expense): Promise<expenseWithId>` and a serialized Firestore document with validated optional import fields.

- [ ] **Step 1: Add failing service contract tests**

```js
test('browser service exposes imported expense writes and preserves import metadata', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  assert.match(source, /async function createImportedExpense\(expense\)/);
  assert.match(source, /originalAmount/);
  assert.match(source, /originalCurrency/);
  assert.match(source, /importSource/);
  assert.match(source, /merchant/);
  assert.match(source, /items/);
  assert.match(source, /confidence/);
  assert.match(source, /importNotes/);
  assert.match(source, /Object\.freeze[\s\S]*createImportedExpense/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/firebase-browser-contract.test.mjs`
Expected: FAIL because `createImportedExpense` is absent.

- [ ] **Step 3: Extend serialization and add the write method**

Add a helper that includes import fields only when `importSource === 'chatgpt-json-v1'`:

```js
function importMetadata(item) {
  if (item.importSource !== 'chatgpt-json-v1') return {};
  return {
    originalAmount: Number(item.originalAmount),
    originalCurrency: item.originalCurrency,
    importSource: 'chatgpt-json-v1',
    merchant: String(item.merchant).slice(0, 100),
    items: item.items.slice(0, 10).map((entry) => ({
      name: String(entry.name).slice(0, 100),
      quantity: Number(entry.quantity), amount: Number(entry.amount),
    })),
    confidence: Number(item.confidence),
    importNotes: String(item.importNotes || '').slice(0, 300),
    importDate: String(item.importDate),
  };
}
```

Permit `住宿` in `expenseItem`. Add:

```js
async function createImportedExpense(expense) {
  if (!currentUser) throw new Error('請先登入');
  const expenseRef = doc(tripCollection('expenses'));
  const data = expenseItem(expense);
  await setDoc(expenseRef, data);
  return { id: expenseRef.id, ...expense };
}
```

Expose the method through `Object.freeze(window.KyushuFamily)`.

- [ ] **Step 4: Run service and core tests**

Run: `node --test tests/firebase-browser-contract.test.mjs tests/firebase-family-core.test.mjs`
Expected: all tests PASS.

- [ ] **Step 5: Commit the Firebase API**

```bash
git add firebase-family.js tests/firebase-browser-contract.test.mjs
git commit -m "feat: persist imported receipt expenses"
```

---

### Task 4: Editable import UI and partial retry

**Files:**
- Modify: `index.html` bundled template expense section
- Modify: `src/app.jsx:252-282,429-472,541-695`
- Modify: `tests/index-integration.test.mjs`

**Interfaces:**
- Consumes: functions from `receipt-import-core.js` and `window.KyushuFamily.createImportedExpense`.
- Produces: prompt-copy action, JSON input, editable draft rows, duplicate/low-confidence warnings, validation errors, and retryable confirmed imports.

- [ ] **Step 1: Add failing integration tests for UI contract**

```js
test('expense UI exposes ChatGPT JSON review and retry flow', async () => {
  const [html, app] = await Promise.all([
    readFile('index.html', 'utf8'), readFile('src/app.jsx', 'utf8'),
  ]);
  const template = JSON.parse(html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
  assert.match(template, /匯入 ChatGPT 辨識結果/);
  assert.match(template, /複製 ChatGPT 提示詞/);
  assert.match(template, /檢查資料/);
  assert.match(template, /確認匯入/);
  assert.match(app, /parseReceiptImport/);
  assert.match(app, /normalizeImportRow/);
  assert.match(app, /createImportedExpense/);
  assert.match(app, /importSucceededIds/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/index-integration.test.mjs`
Expected: FAIL because the import controls and handlers are absent.

- [ ] **Step 3: Add import state and handlers to the React class**

Add state:

```js
importText: '', importRows: [], importErrors: [], importBusy: false,
importResult: '', importSucceededIds: {},
```

Add methods with these exact responsibilities:

```js
checkReceiptImport() {
  const parsed = parseReceiptImport(this.state.importText, this.state.expenses);
  this.setState({
    importRows: parsed.ok ? parsed.rows : [],
    importErrors: parsed.errors,
    importResult: '', importSucceededIds: {},
  });
}

updateImportRow(index, patch) {
  this.setState((state) => ({
    importRows: state.importRows.map((row, i) => i === index ? { ...row, ...patch } : row),
  }));
}
```

Implement `confirmReceiptImport` as a sequential loop. Validate the edited rows again, skip keys in `importSucceededIds`, call `createImportedExpense`, append each success to local expenses, retain failures, and set a result such as `成功 3 筆，失敗 1 筆；可重試失敗資料`。Clear the JSON and drafts only when every selected row succeeds.

- [ ] **Step 4: Add the expense-page template controls**

Add one collapsible section containing:

```html
<details class="import-card">
  <summary>匯入 ChatGPT 辨識結果</summary>
  <button onClick="{{ copyReceiptPrompt }}">複製 ChatGPT 提示詞</button>
  <textarea value="{{ importText }}" onInput="{{ onImportText }}"
    placeholder="貼上 ChatGPT 產生的 JSON"></textarea>
  <button onClick="{{ checkReceiptImport }}">檢查資料</button>
  <!-- Render importErrors and editable importRows here. -->
  <button disabled="{{ importConfirmDisabled }}" onClick="{{ confirmReceiptImport }}">
    確認匯入
  </button>
</details>
```

Each draft row must expose date, merchant, amount, currency, category, and description controls. Render low confidence (`confidence < 0.7`) and duplicate warnings without automatically excluding the row. Use `navigator.clipboard.writeText(CHATGPT_RECEIPT_PROMPT)` with an alert fallback that displays the prompt if clipboard access fails.

- [ ] **Step 5: Rebuild the bundled app**

Run: `node scripts/build-app-bundle.mjs`
Expected: `index.html` is regenerated from `src/app.jsx` without errors.

- [ ] **Step 6: Run UI and core tests**

Run: `node --test tests/index-integration.test.mjs tests/receipt-import-core.test.mjs`
Expected: all tests PASS.

- [ ] **Step 7: Commit the UI**

```bash
git add index.html src/app.jsx receipt-import-core.js tests/index-integration.test.mjs
git commit -m "feat: review and import ChatGPT receipt data"
```

---

### Task 5: Firestore rules and red-team audit

**Files:**
- Modify: `firestore.rules:63-82`
- Modify: `tests/rules-contract.test.mjs`

**Interfaces:**
- Consumes: import metadata emitted by `expenseItem`.
- Produces: identical create/update validation for manual, receipt-backed, and ChatGPT-imported expense documents.

- [ ] **Step 1: Add failing rules contract tests**

```js
test('Firestore validates ChatGPT import metadata without update bypasses', async () => {
  const rules = await readFile('firestore.rules', 'utf8');
  for (const field of ['originalAmount', 'originalCurrency', 'importSource', 'merchant',
    'items', 'confidence', 'importNotes', 'importDate']) {
    assert.match(rules, new RegExp(field));
  }
  assert.match(rules, /data\.originalCurrency in \['JPY', 'TWD'\]/);
  assert.match(rules, /data\.importSource == 'chatgpt-json-v1'/);
  assert.match(rules, /data\.items\.size\(\) <= 10/);
  assert.match(rules, /function isValidImportItem\(item\)/);
  assert.match(rules, /data\.confidence >= 0 && data\.confidence <= 1/);
  assert.match(rules, /hasNoImport\(data\) \|\| hasValidImport\(data\)/);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/rules-contract.test.mjs`
Expected: FAIL because import metadata is not allowed.

- [ ] **Step 3: Add strict optional-import validation**

Define `hasNoImport(data)` so none of the eight import fields may exist. Define `hasValidImport(data)` so all eight fields must exist together and satisfy:

```text
originalAmount: number, > 0, <= 10000000
originalCurrency: JPY or TWD
importSource: exactly chatgpt-json-v1
merchant: non-empty string, <= 100
items: list, <= 10; each map has only name, quantity, and amount
confidence: number, 0 through 1
importNotes: string, <= 300
importDate: one of 2026-07-13 through 2026-07-17
```

Add the fields to `isValidExpense(...).keys().hasOnly(...)`, permit category `住宿`, and require `(hasNoImport(data) || hasValidImport(data))`. Use this same function for both create and update so a valid manual expense cannot be updated into malformed imported data.

Add `isValidImportItem(item)` to require exactly `name`, `quantity`, and `amount`, with a non-empty name up to 100 characters and finite positive numeric values. Add `isValidImportItems(items)` with a maximum of 10 entries and explicit guarded checks for indexes 0 through 9, for example `(items.size() < 1 || isValidImportItem(items[0]))`. This keeps the approved item-object structure while preventing an authenticated client from hiding oversized or malformed maps inside the list.

- [ ] **Step 4: Run rules tests and compile rules**

Run: `node --test tests/rules-contract.test.mjs`
Expected: all tests PASS.

Run: `npx -y firebase-tools@latest deploy --only firestore:rules --project kyushu-family-2026 --dry-run`
Expected: Firestore rules compile successfully without deployment.

- [ ] **Step 5: Perform the security auditor checklist**

Confirm the following target result and record the actual result in the commit notes:

```json
{
  "score": 5,
  "summary": "Imported expense fields are allow-listed, bounded, type-checked, and use the same validation for create and update.",
  "findings": []
}
```

Every checklist item must pass before committing. If one fails, add a failing contract test and correct the rule; record the resulting score rather than copying the target result.

- [ ] **Step 6: Commit the rules**

```bash
git add firestore.rules tests/rules-contract.test.mjs
git commit -m "security: validate imported expense metadata"
```

---

### Task 6: Full verification, deployment, and mobile handoff

**Files:**
- Modify only if a verification failure requires a tested correction.

**Interfaces:**
- Consumes: completed Tasks 1–5.
- Produces: verified branch, deployed Firestore rules, GitHub PR, and mobile test instructions.

- [ ] **Step 1: Run every automated test from a clean command**

Run: `node --test tests/*.test.mjs`
Expected: zero failures.

- [ ] **Step 2: Run structural verification**

Run: `git diff --check origin/main...HEAD`
Expected: no output.

Run: `rg -n "window\.open" firebase-family.js src/app.jsx`
Expected: no Firebase preview call uses `window.open`.

Run: `rg -n "sk-|OPENAI_API_KEY|api\.openai\.com" . --glob '!docs/**' --glob '!.git/**'`
Expected: no client secret or direct OpenAI API integration.

- [ ] **Step 3: Start a local browser test**

Run: `python3 -m http.server 8765`
Expected: the site loads at `http://localhost:8765`.

Verify with an allowed Google account:

1. Existing expenses and documents synchronize.
2. A document preview navigates the current tab and Back restores the app.
3. A receipt preview behaves the same way.
4. The valid sample JSON produces one editable row.
5. Invalid JSON names the failing row/field and writes nothing.
6. A JPY row and a TWD row import and preserve their original values after reload.
7. Re-pasting the same JSON shows duplicate warnings.

- [ ] **Step 4: Deploy the audited Firestore rules**

Run: `npx -y firebase-tools@latest deploy --only firestore:rules --project kyushu-family-2026`
Expected: deployment reports success for `(default)` Firestore rules.

- [ ] **Step 5: Push and open a pull request**

```bash
git push -u origin feature/document-preview-chatgpt-import
gh pr create --base main --head feature/document-preview-chatgpt-import \
  --title "Fix previews and import ChatGPT receipt data" \
  --body "Fixes iPhone Safari Firebase previews and adds validated ChatGPT JSON expense imports with secure Firestore fields."
```

- [ ] **Step 6: Merge only after checks pass and verify GitHub Pages**

After PR checks pass, merge the PR. Confirm the Pages workflow built the merge commit, then fetch the deployed `firebase-family.js` and verify it contains `window.location.assign(url)` and no Firebase preview `window.open` call.

- [ ] **Step 7: User acceptance on iPhone Safari**

Ask the user to close the cached tab, reopen `https://mihsia.github.io/KYUSHU-FAMILY-2026/`, and verify:

- document preview → current page → Back;
- sample JSON → review → confirm import;
- second allowed account sees the imported expense.
