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
