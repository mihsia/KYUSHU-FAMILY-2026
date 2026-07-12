import { mkdir, readFile, writeFile } from 'node:fs/promises';

const html = await readFile('index.html', 'utf8');
const match = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error('bundle template missing');
const template = JSON.parse(match[1]);
const candidates = [...template.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)]
  .map((match) => match[1])
  .filter((text) => text.includes('const DAYS = [') && text.includes('class Component extends DCLogic'));
if (candidates.length !== 1) throw new Error(`expected one app asset, found ${candidates.length}`);
await mkdir('src', { recursive: true });
await writeFile('src/app.jsx', candidates[0]);
