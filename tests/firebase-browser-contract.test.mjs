import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser service exposes auth, sync, and document operations', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  for (const name of ['start', 'signIn', 'signOut', 'subscribe', 'saveState', 'saveRate', 'uploadDocument', 'deleteDocument', 'getStatus']) {
    assert.match(source, new RegExp(`${name}\\s*[:(]`));
  }
  for (const firebaseApi of ['onAuthStateChanged', 'onSnapshot', 'runTransaction', 'serverTimestamp', 'uploadBytesResumable', 'deleteObject']) {
    assert.match(source, new RegExp(firebaseApi));
  }
  assert.match(source, /firebase-config\.js/);
  assert.doesNotMatch(source, /private_key|BEGIN PRIVATE KEY/);
});

test('public config targets the requested Firebase app', async () => {
  const source = await readFile('firebase-config.js', 'utf8');
  assert.match(source, /kyushu-family-2026/);
  assert.match(source, /1:587703256348:web:008781d9569644555126d9/);
  assert.doesNotMatch(source, /private_key|client_email/);
});

test('first migration writes root and structured data in one transaction', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  const migration = source.match(/async function initializeTripIfNeeded\(\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.match(migration, /runTransaction/);
  assert.match(migration, /transaction\.set\(doc\(tripCollection\('wishlist'\)/);
  assert.match(migration, /transaction\.set\(doc\(tripCollection\('expenses'\)/);
  assert.doesNotMatch(migration, /batch\.commit/);
});

test('browser service persists BOT rate audit fields', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  assert.match(source, /rateSource:\s*'BOT cash sell'/);
  assert.match(source, /rateUpdatedAt:\s*serverTimestamp\(\)/);
  assert.match(source, /rateUpdatedBy:\s*currentUser\.uid/);
});

test('only explicit saveRate writes root rate audit metadata', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  const saveState = source.match(/async function saveState\(input\) \{([\s\S]*?)\n\}/)?.[1] || '';
  const saveRate = source.match(/async function saveRate\(rate\) \{([\s\S]*?)\n\}/)?.[1] || '';
  assert.doesNotMatch(saveState, /setDoc\(tripRef\(\)/);
  assert.doesNotMatch(saveState, /rateUpdatedAt|rateUpdatedBy|rateSource/);
  assert.match(saveRate, /setDoc\(tripRef\(\)/);
  assert.match(saveRate, /rateSource:\s*'BOT cash sell'/);
  assert.match(saveRate, /rateUpdatedAt:\s*serverTimestamp\(\)/);
  assert.match(saveRate, /rateUpdatedBy:\s*currentUser\.uid/);
  assert.match(saveRate, /Number\.isFinite/);
});

test('bridge copies shared BOT rate metadata into local storage', async () => {
  const source = await readFile('firebase-bridge.js', 'utf8');
  for (const field of ['rateSource', 'rateUpdatedAt', 'rateUpdatedBy']) {
    assert.match(source, new RegExp(`${field}: snapshot\\.data\\.${field}`));
  }
});

test('browser service exposes receipt-aware expense operations in safe order', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  for (const name of ['createExpenseWithReceipt', 'previewReceipt', 'deleteExpenseWithReceipt']) {
    assert.match(source, new RegExp(`\\b${name}\\b`));
  }
  const createBody = source.match(/async function createExpenseWithReceipt[\s\S]*?\n}/)?.[0] || '';
  assert.ok(createBody.indexOf('uploadBytesResumable') < createBody.indexOf('setDoc(expenseRef'));
  assert.match(createBody, /deleteObject[\s\S]*catch/);
  assert.match(createBody, /validateReceipt\(file\)/);
  assert.match(createBody, /sanitizeReceiptFileName\(file\.name\)/);

  const deleteBody = source.match(/async function deleteExpenseWithReceipt[\s\S]*?\n}/)?.[0] || '';
  assert.ok(deleteBody.indexOf('deleteObject') < deleteBody.indexOf('deleteDoc'));
  assert.match(deleteBody, /throw new Error\('收據刪除失敗，請重試'/);
});

test('generic state sync does not write or diff-delete expenses', async () => {
  const service = await readFile('firebase-family.js', 'utf8');
  const bridge = await readFile('firebase-bridge.js', 'utf8');
  const saveState = service.match(/async function saveState\(input\) \{([\s\S]*?)\n}/)?.[1] || '';
  assert.doesNotMatch(saveState, /syncCollection\('expenses'/);
  assert.doesNotMatch(bridge, /lastCloudExpenses|syncExpenseChanges/);
});
