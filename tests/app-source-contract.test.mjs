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

test('home places converter second and shows the BOT manual rate workflow', async () => {
  const html = await readFile('index.html', 'utf8');
  const raw = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  const template = JSON.parse(raw);
  const home = template.slice(template.indexOf('<!-- ================= HOME ================= -->'), template.indexOf('<!-- ================= ITINERARY ================= -->'));
  const orderedActions = [
    'openItinerary', 'openConverter', 'openFood', 'openWishlist', 'openMustbuy',
    'openPacking', 'openExpense', 'openDocuments', 'openNotes',
  ];
  let previous = -1;
  orderedActions.forEach((action) => {
    const position = home.indexOf(action);
    assert.ok(position > previous, `${action} is out of order`);
    previous = position;
  });
  const labels = [...home.matchAll(/font-size: 18px; font-weight: 900; color: #111;">([^<]+)<\/span>/g)].map((match) => match[1]);
  assert.deepEqual(labels, [
    '行程', '匯率換算', '美食購物指南', '願望清單', '必買清單',
    '行李清單', '記帳', '文件', '備忘資訊',
  ]);
  const numbers = [...home.matchAll(/width: 20px;">(\d{2})<\/div>/g)].map((match) => match[1]);
  assert.deepEqual(numbers, ['01', '02', '03', '04', '05', '06', '07', '08', '09']);
  for (const copy of [
    'https://rate.bot.com.tw/xrt?Lang=zh-TW',
    '臺灣銀行日圓現金賣出價',
    '1 日圓 ≈ {{ ratePerJpy }} 新臺幣',
    '{{ rateUpdatedLabel }}',
    '牌價僅供參考，實際交易以交易當下為準',
  ]) assert.ok(template.includes(copy), `missing converter copy: ${copy}`);
});

test('rate UI keeps shared metadata and only persists a valid positive rate', async () => {
  const source = await readFile('src/app.jsx', 'utf8');
  assert.match(source, /rateMeta:\s*\{/);
  assert.match(source, /rateDraft:\s*String\(/);
  assert.match(source, /saveRate:\s*async \(\) =>/);
  assert.match(source, /window\.KyushuFamily\.saveRate\(rate\)/);
  assert.match(source, /ratePerJpy:\s*\(this\.state\.rate \/ 100\)\.toFixed\(4\)/);
  assert.match(source, /rateError:/);
  assert.doesNotMatch(source, /onRateInput:[\s\S]{0,220}this\.persist\(\)/);

  const html = await readFile('index.html', 'utf8');
  const template = JSON.parse(html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)[1]);
  assert.match(template, /sc-camel-on-click="\{\{ saveRate \}\}"/);
  assert.match(template, /sc-camel-disabled="\{\{ rateSaving \}\}"/);
  assert.match(template, />\{\{ rateSaveLabel \}\}</);
  assert.match(template, /\{\{ rateError \}\}/);
});

test('expense TWD total uses the confirmed shared BOT rate units', async () => {
  const source = await readFile('src/app.jsx', 'utf8');
  assert.match(source, /expenseTotalTwd = Math\.round\(expenseTotalJpy \* \(this\.state\.rate \/ 100\)\)\.toLocaleString\(\)/);
  assert.doesNotMatch(source, /expenseTotalJpy \* 0\.214/);
});

test('bundle builder scopes rate button changes to one exact button block', async () => {
  const source = await readFile('scripts/build-app-bundle.mjs', 'utf8');
  assert.match(source, /const rateSaveButtonPattern =/);
  assert.match(source, /expected exactly one rate save button block/);
  assert.doesNotMatch(source, /\.replace\('>\u5132\u5b58\u532f\u7387<\/button>',/);
});
