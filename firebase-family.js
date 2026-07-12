import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js';
import {
  GoogleAuthProvider,
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js';
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  onSnapshot,
  runTransaction,
  serverTimestamp,
  setDoc,
  writeBatch,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js';
import {
  deleteObject,
  getDownloadURL,
  getStorage,
  ref,
  uploadBytesResumable,
} from 'https://www.gstatic.com/firebasejs/12.15.0/firebase-storage.js';
import { firebaseConfig } from './firebase-config.js';
import {
  TRIP_ID,
  isAllowedEmail,
  normalizeLegacyStore,
  roleForEmail,
  sanitizeReceiptFileName,
  sanitizeFileName,
  validateReceipt,
  validateUpload,
} from './firebase-family-core.js';

const COLLECTIONS = ['wishlist', 'mustbuy', 'packing', 'expenses', 'documents'];
const listeners = new Set();
const cloud = {
  rate: 21.4,
  rateSource: 'BOT cash sell',
  rateUpdatedAt: null,
  rateUpdatedBy: '',
  wishlist: [],
  mustbuy: [],
  packingChecked: {},
  expenses: [],
  documents: {},
};
let app;
let auth;
let db;
let storage;
let currentUser = null;
let status = { phase: 'verifying', message: '正在驗證', user: null, error: null };
let unsubs = [];
let started = false;
let suppressWrites = false;

function tripRef() {
  return doc(db, 'trips', TRIP_ID);
}

function tripCollection(name) {
  return collection(db, 'trips', TRIP_ID, name);
}

function emit(extra = {}) {
  status = { ...status, ...extra };
  const snapshot = { status: { ...status }, data: structuredClone(cloud) };
  listeners.forEach((listener) => listener(snapshot));
  window.dispatchEvent(new CustomEvent('kyushu-family-status', { detail: snapshot }));
}

function clearSubscriptions() {
  unsubs.forEach((unsubscribe) => unsubscribe());
  unsubs = [];
}

function audit() {
  return {
    updatedBy: currentUser.uid,
    updatedAt: serverTimestamp(),
  };
}

function withCreation(item = {}) {
  return {
    ...item,
    createdBy: item.createdBy || currentUser.uid,
    createdAt: item.createdAt || serverTimestamp(),
    ...audit(),
  };
}

function listItem(item) {
  return withCreation({ text: String(item.text || '').slice(0, 300), checked: !!item.checked });
}

function expenseItem(item) {
  const receipt = item.receiptPath ? {
    receiptPath: String(item.receiptPath),
    receiptName: String(item.receiptName),
    receiptType: String(item.receiptType),
    receiptSize: Number(item.receiptSize),
  } : {};
  return withCreation({
    day: Math.max(0, Math.min(4, Number(item.day) || 0)),
    category: ['餐飲', '交通', '購物', '門票', '其他'].includes(item.category) ? item.category : '其他',
    note: String(item.note || '(未命名)').slice(0, 300),
    jpy: Math.max(1, Number(item.jpy) || 1),
    ...receipt,
  });
}

function legacyStore() {
  try {
    const keys = Object.keys(localStorage);
    const key = keys.find((candidate) => {
      try {
        const value = JSON.parse(localStorage.getItem(candidate));
        return value && (value.wishlist || value.mustbuy || value.expenses || value.packingChecked);
      } catch (_) { return false; }
    });
    return normalizeLegacyStore(key ? JSON.parse(localStorage.getItem(key)) : {});
  } catch (_) {
    return normalizeLegacyStore({});
  }
}

async function initializeTripIfNeeded() {
  if (roleForEmail(currentUser.email) !== 'admin') return;
  const source = legacyStore();
  const claimed = await runTransaction(db, async (transaction) => {
    const root = await transaction.get(tripRef());
    if (root.exists()) return false;
    transaction.set(tripRef(), {
      rate: source.rate,
      rateSource: 'BOT cash sell',
      rateUpdatedAt: serverTimestamp(),
      rateUpdatedBy: currentUser.uid,
      initialized: true,
      initializedBy: currentUser.uid,
      initializedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    source.wishlist.forEach((item, index) => transaction.set(doc(tripCollection('wishlist'), item.id || `w${index}`), listItem(item)));
    source.mustbuy.forEach((item, index) => transaction.set(doc(tripCollection('mustbuy'), item.id || `m${index}`), listItem(item)));
    Object.entries(source.packingChecked).forEach(([id, checked]) => transaction.set(doc(tripCollection('packing'), id), { checked: !!checked, ...audit() }));
    source.expenses.forEach((item, index) => transaction.set(doc(tripCollection('expenses'), item.id || `e${index}`), expenseItem(item)));
    return true;
  });
  if (!claimed) return;
  for (const [category, files] of Object.entries(source.documents)) {
    for (const file of files) {
      if (!file.dataUrl) continue;
      try {
        const blob = await fetch(file.dataUrl).then((response) => response.blob());
        await uploadDocument(category, new File([blob], file.name || 'document', { type: blob.type }));
      } catch (error) {
        emit({ phase: 'ready', message: '部分舊文件匯入失敗，可重新上傳', error: error.message });
      }
    }
  }
}

function attachSnapshots() {
  clearSubscriptions();
  unsubs.push(onSnapshot(tripRef(), (snapshot) => {
    if (snapshot.exists()) {
      const root = snapshot.data();
      cloud.rate = Number(root.rate) || 21.4;
      cloud.rateSource = root.rateSource === 'BOT cash sell' ? root.rateSource : 'BOT cash sell';
      cloud.rateUpdatedAt = root.rateUpdatedAt || null;
      cloud.rateUpdatedBy = String(root.rateUpdatedBy || '');
    }
    emit({ phase: 'ready', message: '已同步', error: null });
  }, handleError));
  for (const name of COLLECTIONS) {
    unsubs.push(onSnapshot(tripCollection(name), async (snapshot) => {
      if (name === 'packing') {
        cloud.packingChecked = Object.fromEntries(snapshot.docs.map((entry) => [entry.id, !!entry.data().checked]));
      } else if (name === 'documents') {
        cloud.documents = {};
        const documents = await Promise.all(snapshot.docs.map(async (entry) => {
          const value = { id: entry.id, ...entry.data() };
          try { value.dataUrl = await getDownloadURL(ref(storage, value.storagePath)); }
          catch (_) { value.dataUrl = ''; }
          return value;
        }));
        documents.forEach((value) => {
          (cloud.documents[value.category] ||= []).push(value);
        });
      } else {
        cloud[name] = snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() }));
      }
      emit({ phase: 'ready', message: '已同步', error: null });
    }, handleError));
  }
}

function handleError(error) {
  emit({ phase: navigator.onLine ? 'error' : 'offline', message: navigator.onLine ? '同步失敗，可重試' : '離線', error: error?.message || String(error) });
}

async function syncCollection(name, items, transform) {
  const existing = await getDocs(tripCollection(name));
  const wanted = new Map(items.map((item, index) => [String(item.id || `${name}-${index}`), item]));
  const batch = writeBatch(db);
  existing.docs.forEach((entry) => { if (!wanted.has(entry.id)) batch.delete(entry.ref); });
  wanted.forEach((item, id) => batch.set(doc(tripCollection(name), id), transform(item), { merge: true }));
  await batch.commit();
}

async function saveState(input) {
  if (!currentUser || suppressWrites) return;
  const state = normalizeLegacyStore(input);
  emit({ phase: 'syncing', message: '同步中', error: null });
  try {
    await Promise.all([
      syncCollection('wishlist', state.wishlist, listItem),
      syncCollection('mustbuy', state.mustbuy, listItem),
      syncCollection('packing', Object.entries(state.packingChecked).map(([id, checked]) => ({ id, checked })), (item) => ({ checked: !!item.checked, ...audit() })),
    ]);
    emit({ phase: 'ready', message: '已同步', error: null });
  } catch (error) {
    handleError(error);
    throw error;
  }
}

async function saveRate(rate) {
  if (!currentUser) throw new Error('請先登入');
  rate = Number(rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 100) throw new Error('請輸入 0 到 100 之間的正數匯率');
  emit({ phase: 'syncing', message: '正在儲存匯率', error: null });
  try {
    await setDoc(tripRef(), {
      rate,
      rateSource: 'BOT cash sell',
      rateUpdatedAt: serverTimestamp(),
      rateUpdatedBy: currentUser.uid,
      updatedAt: serverTimestamp(),
    }, { merge: true });
  } catch (error) {
    handleError(error);
    throw error;
  }
}

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
    const path = `trips/${TRIP_ID}/receipts/${expenseRef.id}/${sanitizeReceiptFileName(file.name)}`;
    objectRef = ref(storage, path);
    const task = uploadBytesResumable(objectRef, file, { contentType: file.type });
    await new Promise((resolve, reject) => task.on('state_changed',
      (snapshot) => onProgress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)),
      reject,
      resolve));
    receipt = { receiptPath: path, receiptName: file.name, receiptType: file.type, receiptSize: file.size };
  }
  try {
    await setDoc(expenseRef, expenseItem({ ...expense, ...receipt }));
  } catch (error) {
    if (objectRef) await deleteObject(objectRef).catch(() => {});
    throw error;
  }
  return { id: expenseRef.id, ...expense, ...receipt };
}

async function previewReceipt(expense) {
  if (!expense.receiptPath) throw new Error('此筆記帳沒有收據');
  const url = await getDownloadURL(ref(storage, expense.receiptPath));
  window.open(url, '_blank', 'noopener');
}

async function deleteExpenseWithReceipt(expense) {
  if (!currentUser) throw new Error('請先登入');
  if (expense.receiptPath) {
    try {
      await deleteObject(ref(storage, expense.receiptPath));
    } catch (error) {
      if (error?.code === 'storage/object-not-found') {
        // A prior attempt already removed the receipt; resume with Firestore.
      } else {
        throw new Error('收據刪除失敗，請重試');
      }
    }
  }
  await deleteDoc(doc(tripCollection('expenses'), String(expense.id)));
}

async function uploadDocument(category, file, onProgress = () => {}) {
  const validation = validateUpload(file);
  if (!validation.ok) throw new Error(validation.error);
  if (!currentUser) throw new Error('請先登入');
  const documentRef = doc(tripCollection('documents'));
  const path = `trips/${TRIP_ID}/documents/${documentRef.id}/${sanitizeFileName(file.name)}`;
  const objectRef = ref(storage, path);
  const task = uploadBytesResumable(objectRef, file, { contentType: file.type });
  await new Promise((resolve, reject) => task.on('state_changed',
    (snapshot) => onProgress(Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100)),
    reject,
    resolve));
  await setDoc(documentRef, withCreation({ category, name: file.name, storagePath: path, contentType: file.type, size: file.size }));
  return { id: documentRef.id, category, name: file.name, storagePath: path };
}

async function deleteDocument(documentData) {
  if (!currentUser) throw new Error('請先登入');
  await deleteObject(ref(storage, documentData.storagePath));
  await deleteDoc(doc(tripCollection('documents'), documentData.id));
}

async function previewDocument(documentData) {
  const url = await getDownloadURL(ref(storage, documentData.storagePath));
  window.open(url, '_blank', 'noopener');
}

async function start() {
  if (started) return;
  started = true;
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
  window.addEventListener('online', () => emit({ phase: 'ready', message: '已同步' }));
  window.addEventListener('offline', () => emit({ phase: 'offline', message: '離線' }));
  onAuthStateChanged(auth, async (user) => {
    clearSubscriptions();
    currentUser = null;
    if (!user) {
      emit({ phase: 'signed-out', message: '使用 Google 登入', user: null, error: null });
      return;
    }
    if (!isAllowedEmail(user.email) || !user.emailVerified) {
      emit({ phase: 'unauthorized', message: '此帳號未獲邀請', user: null, error: null });
      await firebaseSignOut(auth);
      return;
    }
    currentUser = user;
    await setDoc(doc(db, 'members', user.uid), {
      email: user.email,
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      role: roleForEmail(user.email),
      lastLoginAt: serverTimestamp(),
    }, { merge: true });
    emit({ phase: 'loading', message: '正在載入雲端資料', user: publicUser(user), error: null });
    await initializeTripIfNeeded();
    attachSnapshots();
  });
}

function publicUser(user) {
  return user ? { uid: user.uid, email: user.email, displayName: user.displayName || '', photoURL: user.photoURL || '', role: roleForEmail(user.email) } : null;
}

function signIn() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  return signInWithPopup(auth, provider);
}

function signOut() {
  clearSubscriptions();
  return firebaseSignOut(auth);
}

function subscribe(listener) {
  listeners.add(listener);
  listener({ status: { ...status }, data: structuredClone(cloud) });
  return () => listeners.delete(listener);
}

function getStatus() {
  return { ...status, user: publicUser(currentUser) };
}

window.KyushuFamily = Object.freeze({
  start,
  signIn,
  signOut,
  subscribe,
  saveState,
  saveRate,
  createExpenseWithReceipt,
  previewReceipt,
  deleteExpenseWithReceipt,
  uploadDocument,
  deleteDocument,
  previewDocument,
  getStatus,
});
