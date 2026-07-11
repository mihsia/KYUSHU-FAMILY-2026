import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('browser service exposes auth, sync, and document operations', async () => {
  const source = await readFile('firebase-family.js', 'utf8');
  for (const name of ['start', 'signIn', 'signOut', 'subscribe', 'saveState', 'uploadDocument', 'deleteDocument', 'getStatus']) {
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
