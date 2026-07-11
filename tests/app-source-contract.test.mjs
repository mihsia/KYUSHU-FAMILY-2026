import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('editable app source exists and matches the bundled app asset', async () => {
  const source = await readFile('src/app.jsx', 'utf8');
  const html = await readFile('index.html', 'utf8');
  const raw = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  assert.ok(raw, 'bundle template missing');
  const template = JSON.parse(raw);
  const candidates = [...template.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
    .map((match) => match[1])
    .filter((text) => text.includes('const DAYS = [') && text.includes('class Component extends DCLogic'));
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0], source);
});
