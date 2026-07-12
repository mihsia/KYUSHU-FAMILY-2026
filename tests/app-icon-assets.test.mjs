import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const expected = new Map([
  ['assets/icons/fukuoka-app-icon-1024.png', 1024],
  ['apple-touch-icon.png', 180],
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['favicon-32.png', 32],
]);

function pngInfo(bytes) {
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    colorType: bytes.readUInt8(25),
  };
}

test('app icon PNGs exist at exact opaque square sizes', async () => {
  for (const [path, size] of expected) {
    const info = pngInfo(await readFile(path));
    assert.deepEqual(
      { width: info.width, height: info.height },
      { width: size, height: size },
      path,
    );
    assert.ok(![4, 6].includes(info.colorType), `${path} must not have an alpha channel`);
  }
});
