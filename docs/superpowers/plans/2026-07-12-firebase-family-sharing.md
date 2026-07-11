# Firebase Family Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓兩個指定 Google 帳號登入九州親子遊網站，共用並即時同步清單、行李、旅費、匯率與旅行文件。

**Architecture:** 保留 GitHub Pages 與現有單一 `index.html`，新增獨立的 Firebase Web 模組，將 Authentication、Firestore 與 Storage 封裝在 `firebase-family.js`。現有 React 狀態透過小範圍介面接到雲端服務，安全性由 Firestore 與 Storage Rules 強制執行。

**Tech Stack:** Firebase Web SDK、Google Authentication、Cloud Firestore、Firebase Storage、Firebase CLI、Node.js built-in test runner、GitHub Pages

## Global Constraints

- Firebase project ID 固定為 `kyushu-family-2026`。
- Firebase Web App ID 固定為 `1:587703256348:web:008781d9569644555126d9`。
- 管理者固定為 `mihsia@gmail.com`；成員固定為 `pandora0119@gmail.com`。
- 旅行 ID 固定為 `kyushu-2026`。
- 保留現有 `index.html` 外觀、功能與 GitHub Pages 發布方式。
- 管理者首次登入時遷移 `localStorage`；遷移後不刪除本機備份。
- 文件單檔上限固定為 10 MB；允許 PDF、JPEG、PNG、WebP。
- 所有非預期 Firestore 與 Storage 路徑預設拒絕。

---

### Task 1: Firebase project configuration and rules

**Files:**
- Create: `.firebaserc`
- Create: `firebase.json`
- Create: `firestore.rules`
- Create: `storage.rules`
- Create: `tests/rules-contract.test.mjs`

**Interfaces:**
- Consumes: Firebase project `kyushu-family-2026` and trip ID `kyushu-2026`.
- Produces: deployable Auth, Firestore and Storage configuration with email allow-list enforcement.

- [ ] **Step 1: Verify Firebase CLI login and project access**

Run:

```bash
npx -y firebase-tools@latest --version
npx -y firebase-tools@latest login:list
npx -y firebase-tools@latest projects:list
```

Expected: CLI prints a version, at least one logged-in account, and a row whose Project ID is `kyushu-family-2026`.

- [ ] **Step 2: Inspect Firestore edition before choosing rules guidance**

Run:

```bash
npx -y firebase-tools@latest firestore:databases:list --project kyushu-family-2026
npx -y firebase-tools@latest firestore:databases:get '(default)' --project kyushu-family-2026
```

Expected: the database response identifies its edition and location. Follow the matching Firebase skill reference for Standard or Enterprise before writing rules. If no database exists, stop provisioning and ask for the preferred location as required by the Firebase Firestore workflow.

- [ ] **Step 3: Write a failing static rules contract test**

Create `tests/rules-contract.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const allowed = ['mihsia@gmail.com', 'pandora0119@gmail.com'];

test('Firestore rules restrict the fixed trip to the two allowed emails', async () => {
  const rules = await readFile('firestore.rules', 'utf8');
  assert.match(rules, /kyushu-2026/);
  allowed.forEach(email => assert.match(rules, new RegExp(email.replace('.', '\\.'))));
  assert.match(rules, /request\.auth != null/);
  assert.match(rules, /allow read, write: if isAllowed\(\)/);
});

test('Storage rules enforce allow-list, types, and 10 MB limit', async () => {
  const rules = await readFile('storage.rules', 'utf8');
  allowed.forEach(email => assert.match(rules, new RegExp(email.replace('.', '\\.'))));
  assert.match(rules, /10 \* 1024 \* 1024/);
  assert.match(rules, /application\\\/pdf/);
  assert.match(rules, /image\\\//);
});
```

- [ ] **Step 4: Run the contract test and verify failure**

Run: `node --test tests/rules-contract.test.mjs`

Expected: FAIL because `firestore.rules` and `storage.rules` do not exist.

- [ ] **Step 5: Create Firebase configuration**

Create `.firebaserc`:

```json
{
  "projects": {
    "default": "kyushu-family-2026"
  }
}
```

Create `firebase.json`:

```json
{
  "firestore": { "rules": "firestore.rules" },
  "storage": { "rules": "storage.rules" },
  "auth": {
    "providers": {
      "googleSignIn": {
        "oAuthBrandDisplayName": "九州親子遊 2026",
        "supportEmail": "mihsia@gmail.com",
        "authorizedRedirectUris": [
          "https://mihsia.github.io",
          "http://localhost"
        ]
      }
    }
  }
}
```

Create `firestore.rules`:

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAllowed() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in [
          'mihsia@gmail.com',
          'pandora0119@gmail.com'
        ];
    }

    match /trips/kyushu-2026 {
      allow read, write: if isAllowed();
      match /{collection}/{document=**} {
        allow read, write: if isAllowed()
          && collection in ['wishlist', 'mustbuy', 'packing', 'expenses', 'documents'];
      }
    }

    match /members/{uid} {
      allow read: if isAllowed();
      allow create, update: if isAllowed() && request.auth.uid == uid;
      allow delete: if false;
    }

    match /{document=**} { allow read, write: if false; }
  }
}
```

Create `storage.rules`:

```text
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function isAllowed() {
      return request.auth != null
        && request.auth.token.email_verified == true
        && request.auth.token.email in [
          'mihsia@gmail.com',
          'pandora0119@gmail.com'
        ];
    }
    function validUpload() {
      return request.resource.size <= 10 * 1024 * 1024
        && (request.resource.contentType == 'application/pdf'
          || request.resource.contentType.matches('image/.*'));
    }
    match /trips/kyushu-2026/documents/{documentId}/{fileName} {
      allow read, delete: if isAllowed();
      allow create, update: if isAllowed() && validUpload();
    }
    match /{allPaths=**} { allow read, write: if false; }
  }
}
```

- [ ] **Step 6: Run tests and validate rules**

Run:

```bash
node --test tests/rules-contract.test.mjs
npx -y firebase-tools@latest deploy --only firestore:rules,storage,auth --project kyushu-family-2026 --dry-run
```

Expected: contract tests PASS and Firebase CLI accepts the configuration without syntax errors.

- [ ] **Step 7: Commit Firebase configuration**

```bash
git add .firebaserc firebase.json firestore.rules storage.rules tests/rules-contract.test.mjs
git commit -m "Configure Firebase access rules"
```

---

### Task 2: Testable Firebase family data adapter

**Files:**
- Create: `firebase-family-core.js`
- Create: `tests/firebase-family-core.test.mjs`

**Interfaces:**
- Produces: `isAllowedEmail(email)`, `roleForEmail(email)`, `sanitizeFileName(name)`, `validateUpload(file)`, `normalizeLegacyStore(store)`, and constants `TRIP_ID`, `MAX_FILE_SIZE`, `ALLOWED_EMAILS`.
- Consumes: plain JavaScript objects only; this module has no browser or Firebase dependency.

- [ ] **Step 1: Write failing core tests**

Create tests covering exact behavior:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isAllowedEmail, roleForEmail, sanitizeFileName,
  validateUpload, normalizeLegacyStore, MAX_FILE_SIZE
} from '../firebase-family-core.js';

test('allow-list is case-insensitive and assigns roles', () => {
  assert.equal(isAllowedEmail('MIHSIA@gmail.com'), true);
  assert.equal(roleForEmail('mihsia@gmail.com'), 'admin');
  assert.equal(roleForEmail('pandora0119@gmail.com'), 'member');
  assert.equal(isAllowedEmail('outsider@gmail.com'), false);
});

test('file validation accepts supported files up to 10 MB', () => {
  assert.deepEqual(validateUpload({ size: MAX_FILE_SIZE, type: 'application/pdf' }), { ok: true });
  assert.equal(validateUpload({ size: MAX_FILE_SIZE + 1, type: 'application/pdf' }).ok, false);
  assert.equal(validateUpload({ size: 10, type: 'text/html' }).ok, false);
});

test('legacy store receives safe defaults without losing existing values', () => {
  const result = normalizeLegacyStore({ rate: 22, wishlist: [{ id: 'w1', text: '藥妝' }] });
  assert.equal(result.rate, 22);
  assert.equal(result.wishlist.length, 1);
  assert.deepEqual(result.expenses, []);
  assert.deepEqual(result.documents, { '機票': [], '住宿': [], 'VJW': [], '保險': [], '其他': [] });
});
```

- [ ] **Step 2: Run tests and verify module-not-found failure**

Run: `node --test tests/firebase-family-core.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement the pure adapter**

Implement the exported constants and functions. `validateUpload` must return `{ok:false, error:'檔案超過 10 MB'}` or `{ok:false, error:'只允許 PDF、JPEG、PNG 或 WebP'}`. `normalizeLegacyStore` must preserve valid arrays and default missing structures without mutating its input.

- [ ] **Step 4: Run core tests**

Run: `node --test tests/firebase-family-core.test.mjs`

Expected: all tests PASS.

- [ ] **Step 5: Commit the pure adapter**

```bash
git add firebase-family-core.js tests/firebase-family-core.test.mjs
git commit -m "Add Firebase family data adapter"
```

---

### Task 3: Firebase browser service

**Files:**
- Create: `firebase-config.js`
- Create: `firebase-family.js`
- Create: `tests/firebase-browser-contract.test.mjs`

**Interfaces:**
- Consumes: exports from `firebase-family-core.js` and Firebase modular CDN SDK.
- Produces: `window.KyushuFamily` with methods `start()`, `signIn()`, `signOut()`, `subscribe(listener)`, `saveState(state)`, `uploadDocument(category,file)`, `deleteDocument(document)`, and `getStatus()`.

- [ ] **Step 1: Retrieve the registered Web app configuration**

Run:

```bash
npx -y firebase-tools@latest apps:sdkconfig WEB 1:587703256348:web:008781d9569644555126d9 --project kyushu-family-2026
```

Expected: JSON containing `projectId: "kyushu-family-2026"`, `appId`, `apiKey`, `authDomain`, `storageBucket`, and `messagingSenderId`. Save those returned public values as `export const firebaseConfig = Object.freeze({...})` in `firebase-config.js`.

- [ ] **Step 2: Write a failing browser service contract test**

Create a Node static contract test that reads `firebase-family.js` and asserts the exported global exposes all eight required methods, imports `firebase-config.js`, checks `onAuthStateChanged`, `onSnapshot`, `runTransaction`, `serverTimestamp`, `uploadBytesResumable`, and `deleteObject`, and contains no service-account private key.

- [ ] **Step 3: Run the contract test and verify failure**

Run: `node --test tests/firebase-browser-contract.test.mjs`

Expected: FAIL because `firebase-family.js` does not exist.

- [ ] **Step 4: Implement Authentication and membership gate**

Use the Firebase modular CDN at one pinned version throughout the file. `start()` initializes Auth, Firestore and Storage once, listens to `onAuthStateChanged`, rejects non-allow-listed emails before attaching any data listener, and upserts only the current user's safe member fields.

- [ ] **Step 5: Implement Firestore synchronization and one-time migration**

Use `runTransaction` on `trips/kyushu-2026` to claim initialization. Convert existing local state into per-item documents using stable IDs. Attach snapshot listeners for root state and the five subcollections. Coalesce the snapshots into the legacy state shape expected by the existing component and deliver it through `subscribe(listener)`.

- [ ] **Step 6: Implement Storage document operations**

Validate size and MIME type before upload. Upload to `trips/kyushu-2026/documents/{documentId}/{safeFileName}`, report progress, then write metadata. Delete the Storage object and its Firestore metadata; return a retryable error object if either operation fails.

- [ ] **Step 7: Run the browser contract and core tests**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS.

- [ ] **Step 8: Commit the browser service**

```bash
git add firebase-config.js firebase-family.js tests/firebase-browser-contract.test.mjs
git commit -m "Add Firebase browser sharing service"
```

---

### Task 4: Integrate login and shared state into the existing UI

**Files:**
- Modify: `index.html` at the existing `loadStore`, `saveStore`, `Component` lifecycle, document upload and document deletion anchors
- Create: `firebase-family.css`
- Create: `tests/index-integration.test.mjs`

**Interfaces:**
- Consumes: `window.KyushuFamily` from Task 3.
- Produces: an authentication gate, member identity, sync status, shared state subscription, and cloud document actions without redesigning existing screens.

- [ ] **Step 1: Write failing HTML integration tests**

The test must assert that `index.html` loads `firebase-family.css`, `firebase-family.js` as a module, contains IDs `firebase-auth-gate`, `firebase-user`, and `firebase-sync-status`, calls `KyushuFamily.start()`, unsubscribes on unmount, and routes document upload/delete through the cloud service.

- [ ] **Step 2: Run the integration test and verify failure**

Run: `node --test tests/index-integration.test.mjs`

Expected: FAIL because the Firebase assets and integration anchors are absent.

- [ ] **Step 3: Add authentication gate and status UI**

Add an accessible full-screen gate with the exact states `正在驗證`, `使用 Google 登入`, and `此帳號未獲邀請`. Add a compact signed-in member control and exact sync labels `同步中`, `已同步`, `離線`, and `同步失敗，可重試`. Style these in `firebase-family.css` using the existing visual language.

- [ ] **Step 4: Bridge the existing state lifecycle**

Keep `loadStore()` as the local migration source. After successful authentication, subscribe to `KyushuFamily`; replace the component's shared fields from cloud snapshots while preserving navigation and draft input state. Replace `persist()` with a cloud save request plus local backup. Remove listeners during unmount and sign-out.

- [ ] **Step 5: Bridge document operations**

Replace data-URL-only upload with `KyushuFamily.uploadDocument`, show per-file progress and errors, and route previews and deletions through Storage-backed metadata. Keep legacy data URLs available until migration reports success.

- [ ] **Step 6: Run all local tests and inspect HTML integrity**

Run:

```bash
node --test tests/*.test.mjs
git diff --check
```

Expected: all tests PASS and `git diff --check` prints nothing.

- [ ] **Step 7: Commit UI integration**

```bash
git add index.html firebase-family.css tests/index-integration.test.mjs
git commit -m "Integrate Google login and family sync"
```

---

### Task 5: Deploy Firebase configuration and verify locally

**Files:**
- Modify only if validation finds defects: Firebase configuration, rules, service, UI, or tests from Tasks 1–4

**Interfaces:**
- Consumes: deployable Firebase configuration and the integrated static site.
- Produces: enabled Google provider, deployed security rules, and a locally verified application.

- [ ] **Step 1: Deploy Auth and security rules**

Run:

```bash
npx -y firebase-tools@latest deploy --only auth,firestore:rules,storage --project kyushu-family-2026
```

Expected: all selected resources deploy successfully.

- [ ] **Step 2: Start a local static server**

Run: `python3 -m http.server 8765`

Expected: `http://localhost:8765/` serves `index.html` and all Firebase assets with HTTP 200.

- [ ] **Step 3: Test authentication states in a browser**

Verify signed-out gate, admin login, member login, outsider rejection, logout, user identity, and no travel-content flash before authorization.

- [ ] **Step 4: Test two-browser real-time synchronization**

Open two independent signed-in sessions. Verify add, toggle, edit, and delete behavior for wishlist, must-buy, packing, expenses, and exchange rate without reloading either page.

- [ ] **Step 5: Test one-time migration and documents**

Verify the admin migration runs exactly once, local backup remains, supported files upload/preview/delete, a file over 10 MB is rejected, and an HTML file is rejected.

- [ ] **Step 6: Re-run automated checks**

Run:

```bash
node --test tests/*.test.mjs
git diff --check
git status --short
```

Expected: tests PASS, diff check is empty, and only intentional tracked changes are present.

---

### Task 6: Publish and production verification

**Files:**
- No new files unless production verification reveals a defect

**Interfaces:**
- Consumes: locally verified `main` branch.
- Produces: a working production site at `https://mihsia.github.io/KYUSHU-FAMILY-2026/`.

- [ ] **Step 1: Push the implementation commits**

Run: `git push origin main`

Expected: remote `main` advances to the local tested commit.

- [ ] **Step 2: Wait for GitHub Pages to build**

Run:

```bash
/opt/homebrew/bin/gh api repos/mihsia/KYUSHU-FAMILY-2026/pages --jq '{status,html_url}'
```

Expected: `status` becomes `built` and `html_url` is the production URL.

- [ ] **Step 3: Verify production authentication and synchronization**

Repeat the admin/member login, outsider rejection, two-session sync, document lifecycle, logout, and reload checks against the production URL.

- [ ] **Step 4: Final repository verification**

Run:

```bash
git fetch origin main
git status --short --branch
git log -1 --oneline --decorate
```

Expected: local `main` equals `origin/main`; untracked local PDFs and alternate HTML files remain uncommitted and untouched.
