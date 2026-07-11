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

test('trip source contains approved flight copy, overview, and five-day guide content', async () => {
  const source = await readFile('src/app.jsx', 'utf8');
  for (const text of [
    '去程集合｜7/13（一）凌晨 04:20',
    '桃園機場第二航廈・華航 7 號櫃台',
    "key: 'overview', label: '總覽'",
    '長崎海風與企鵝的夏日序曲',
    '穿越有明海，遇見萌熊列車',
    '由布院之森，開往森林深處的列車',
    '野生動物、學問之神與福岡購物',
    '帶著九州夏日記憶返程',
    '今日看點', '今日任務', '本日三必', '旅行提醒', '行程異動',
  ]) assert.match(source, new RegExp(text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('approved D1 overview region and D2 must-eat copy stay exact', async () => {
  const source = await readFile('src/app.jsx', 'utf8');
  assert.match(source, /id: 0, date: '7\/13', dow: '一', color: '#2a8c82', region: '長崎・佐世保'/);
  assert.match(source, /mustEat: \['糰子', '馬肉可樂餅', '熊本拉麵'\]/);
});
