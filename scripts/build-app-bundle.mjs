import { readFile, writeFile } from 'node:fs/promises';

const [html, source] = await Promise.all([
  readFile('index.html', 'utf8'),
  readFile('src/app.jsx', 'utf8'),
]);
const match = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/);
if (!match) throw new Error('bundle template missing');
const template = JSON.parse(match[1]);
const appPattern = /(<script[^>]*>)([\s\S]*?)(<\/script>)/g;
const candidates = [...template.matchAll(appPattern)]
  .filter((candidate) => candidate[2].includes('const DAYS = [') && candidate[2].includes('class Component extends DCLogic'));
if (candidates.length !== 1) throw new Error(`expected one app asset, found ${candidates.length}`);
const candidate = candidates[0];
const updatedTemplate = template.slice(0, candidate.index)
  + candidate[1] + source + candidate[3]
  + template.slice(candidate.index + candidate[0].length);
const serializedTemplate = JSON.stringify(updatedTemplate).replaceAll('</', '<\\u002F');
const replacement = `<script type="__bundler/template">\n${serializedTemplate}\n  </script>`;
await writeFile('index.html', html.slice(0, match.index) + replacement + html.slice(match.index + match[0].length));
