import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const allowed = ['mihsia@gmail.com', 'pandora0119@gmail.com'];

test('Firestore rules restrict the fixed trip to the two allowed emails', async () => {
  const rules = await readFile('firestore.rules', 'utf8');
  assert.match(rules, /kyushu-2026/);
  allowed.forEach((email) => assert.match(rules, new RegExp(email.replace('.', '\\.'))));
  assert.match(rules, /request\.auth != null/);
  assert.match(rules, /function isValid/);
  assert.match(rules, /allow read/);
});

test('Storage rules enforce allow-list, types, and 10 MB limit', async () => {
  const rules = await readFile('storage.rules', 'utf8');
  allowed.forEach((email) => assert.match(rules, new RegExp(email.replace('.', '\\.'))));
  assert.match(rules, /10 \* 1024 \* 1024/);
  assert.match(rules, /application\/pdf/);
  assert.match(rules, /image\/\.*/);
});

test('Firebase config enables Google sign-in for localhost and GitHub Pages', async () => {
  const config = JSON.parse(await readFile('firebase.json', 'utf8'));
  assert.equal(config.auth.providers.googleSignIn.supportEmail, 'mihsia@gmail.com');
  assert.ok(config.auth.providers.googleSignIn.authorizedRedirectUris.includes('http://localhost'));
  assert.ok(config.auth.providers.googleSignIn.authorizedRedirectUris.includes('https://mihsia.github.io'));
});

test('Firestore root schema requires BOT rate audit metadata', async () => {
  const rules = await readFile('firestore.rules', 'utf8');
  assert.match(rules, /'rateSource', 'rateUpdatedAt', 'rateUpdatedBy'/);
  assert.match(rules, /data\.rate > 0 && data\.rate <= 100/);
  assert.match(rules, /data\.rateSource == 'BOT cash sell'/);
  assert.match(rules, /data\.rateUpdatedAt is timestamp/);
  assert.match(rules, /data\.rateUpdatedBy is string && data\.rateUpdatedBy\.size\(\) > 0/);
});

test('Firestore expense receipt fields are atomic, image-only, and tied to the expense id', async () => {
  const rules = await readFile('firestore.rules', 'utf8');
  assert.match(rules, /function hasNoReceipt\(data\)/);
  assert.match(rules, /function hasValidReceipt\(data, expenseId\)/);
  assert.match(rules, /expenseId\.matches\('\^\[A-Za-z0-9_-\]\+\$'\)/);
  assert.match(rules, /hasAll\(\['receiptPath', 'receiptName', 'receiptType', 'receiptSize'\]\)/);
  assert.ok(rules.includes("^trips/kyushu-2026/receipts/' + expenseId + '/[A-Za-z0-9._-]+$"));
  assert.match(rules, /data\.receiptType\.matches\('\^image\/\(jpeg\|png\|webp\)\$'\)/);
  assert.match(rules, /data\.receiptSize is int && data\.receiptSize > 0 && data\.receiptSize <= 10 \* 1024 \* 1024/);
  assert.match(rules, /hasNoReceipt\(data\) \|\| hasValidReceipt\(data, expenseId\)/);
});

test('Storage rules preserve document uploads and restrict receipts to images up to 10 MB', async () => {
  const rules = await readFile('storage.rules', 'utf8');
  allowed.forEach((email) => assert.match(rules, new RegExp(email.replace('.', '\\.'))));
  assert.match(rules, /documents\/\{documentId\}\/\{fileName\}/);
  assert.match(rules, /application\/pdf/);
  assert.match(rules, /receipts\/\{expenseId\}\/\{fileName\}/);
  assert.match(rules, /fileName\.matches\('\^\[A-Za-z0-9\._-\]\+\$'\)/);
  assert.match(rules, /request\.resource\.size > 0/);
  assert.match(rules, /request\.resource\.size <= 10 \* 1024 \* 1024/);
  assert.match(rules, /request\.resource\.contentType\.matches\('image\/\(jpeg\|png\|webp\)'\)/);
});
