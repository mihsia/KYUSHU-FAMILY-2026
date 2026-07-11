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

test('bridge starts Firebase and synchronizes local application state', async () => {
  const source = await readFile('firebase-bridge.js', 'utf8');
  assert.match(source, /KyushuFamily\.start\(\)/);
  assert.match(source, /KyushuFamily\.subscribe/);
  assert.match(source, /KyushuFamily\.saveState/);
  assert.match(source, /KyushuFamily\.uploadDocument/);
  assert.match(source, /KyushuFamily\.deleteDocument/);
  assert.match(source, /kyushu-family-app-v1/);
});
