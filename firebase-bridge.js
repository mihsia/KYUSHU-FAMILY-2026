import './firebase-family.js';

const STORE_KEY = 'kyushu-family-app-v1';
const originalSetItem = Storage.prototype.setItem;
let applyingCloud = false;
let cloudTimer = 0;
let lastCloudDocuments = [];

function ensureShell() {
  if (!document.querySelector('link[href="firebase-family.css"]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'firebase-family.css';
    document.head.appendChild(link);
  }
  if (!document.getElementById('firebase-auth-gate')) {
    document.body.insertAdjacentHTML('beforeend', `
      <section id="firebase-auth-gate" aria-live="polite">
        <div class="firebase-card">
          <h1>九州親子遊 2026</h1>
          <p id="firebase-auth-message">正在驗證</p>
          <button id="firebase-sign-in" type="button" hidden>使用 Google 登入</button>
        </div>
      </section>
      <aside id="firebase-account-bar" hidden>
        <span id="firebase-user"></span>
        <span id="firebase-sync-status">正在驗證</span>
        <button id="firebase-sign-out" type="button">登出</button>
      </aside>`);
    document.getElementById('firebase-sign-in').addEventListener('click', () => window.KyushuFamily.signIn());
    document.getElementById('firebase-sign-out').addEventListener('click', () => window.KyushuFamily.signOut());
  }
}

function currentState() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}'); }
  catch (_) { return {}; }
}

function flattenDocuments(documents = {}) {
  return Object.values(documents).flat().filter(Boolean);
}

async function syncDocumentChanges(next) {
  const localDocuments = flattenDocuments(next.documents);
  const removed = lastCloudDocuments.filter((cloudDoc) => cloudDoc.id && !localDocuments.some((item) => item.id === cloudDoc.id));
  const added = Object.entries(next.documents || {}).flatMap(([category, files]) =>
    (files || []).filter((file) => file.dataUrl && !file.id).map((file) => ({ category, file })));
  await Promise.all(removed.map((file) => window.KyushuFamily.deleteDocument(file).catch(console.error)));
  await Promise.all(added.map(async ({ category, file }) => {
    const blob = await fetch(file.dataUrl).then((response) => response.blob());
    return window.KyushuFamily.uploadDocument(category, new File([blob], file.name, { type: blob.type }));
  }));
}

async function handleLocalSave(value) {
  if (applyingCloud || !window.KyushuFamily) return;
  try {
    const state = JSON.parse(value);
    await syncDocumentChanges(state);
    await window.KyushuFamily.saveState(state);
  } catch (error) {
    console.error('Firebase family sync failed:', error);
  }
}

Storage.prototype.setItem = function setItem(key, value) {
  originalSetItem.call(this, key, value);
  if (this === localStorage && key === STORE_KEY) void handleLocalSave(value);
};

function updateShell(snapshot) {
  ensureShell();
  const { status } = snapshot;
  const gate = document.getElementById('firebase-auth-gate');
  const message = document.getElementById('firebase-auth-message');
  const signIn = document.getElementById('firebase-sign-in');
  const account = document.getElementById('firebase-account-bar');
  message.textContent = status.message;
  signIn.hidden = status.phase !== 'signed-out' && status.phase !== 'unauthorized';
  const ready = ['ready', 'syncing', 'offline', 'error', 'loading'].includes(status.phase) && status.user;
  gate.hidden = !!ready;
  account.hidden = !ready;
  if (ready) {
    document.getElementById('firebase-user').textContent = status.user.displayName || status.user.email;
    document.getElementById('firebase-sync-status').textContent = status.message;
  }
}

function applyCloud(snapshot) {
  updateShell(snapshot);
  if (snapshot.status.phase !== 'ready') return;
  clearTimeout(cloudTimer);
  cloudTimer = window.setTimeout(() => {
    const local = currentState();
    const next = {
      ...local,
      wishlist: snapshot.data.wishlist,
      mustbuy: snapshot.data.mustbuy,
      packingChecked: snapshot.data.packingChecked,
      documents: { 機票: [], 住宿: [], VJW: [], 保險: [], 其他: [], ...snapshot.data.documents },
      expenses: snapshot.data.expenses,
      rate: snapshot.data.rate,
      rateSource: snapshot.data.rateSource,
      rateUpdatedAt: snapshot.data.rateUpdatedAt,
      rateUpdatedBy: snapshot.data.rateUpdatedBy,
    };
    lastCloudDocuments = flattenDocuments(next.documents);
    const encoded = JSON.stringify(next);
    if (localStorage.getItem(STORE_KEY) === encoded) return;
    applyingCloud = true;
    originalSetItem.call(localStorage, STORE_KEY, encoded);
    applyingCloud = false;
    window.location.reload();
  }, 700);
}

new MutationObserver(ensureShell).observe(document, { childList: true, subtree: true });
ensureShell();
window.KyushuFamily.subscribe(applyCloud);
window.KyushuFamily.start().catch((error) => updateShell({ status: { phase: 'error', message: '同步失敗，可重試', error }, data: {} }));
