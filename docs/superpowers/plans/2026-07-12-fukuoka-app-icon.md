# Fukuoka App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create and deploy a polished Fukuoka-inspired Apple Touch Icon and PWA icon set for the Kyushu family trip app.

**Architecture:** Generate one approved 1024px opaque master illustration with the built-in image generation tool, derive deterministic PNG sizes, and reference them from the outer document head, bundled template head, and a new web app manifest. Keep image generation separate from code integration so visual approval and technical validation can be reviewed independently.

**Tech Stack:** Built-in image generation, PNG assets, native macOS image resizing or bundled Python/Pillow, HTML metadata, Web App Manifest JSON, Node.js built-in tests, GitHub Pages.

## Global Constraints

- Visual direction is A `海風福岡`: simplified Fukuoka Tower, coral sunset, and Hakata Bay waves.
- Palette uses `#12363D`, `#0C2930`, `#F7F1E8`, `#69C9BD`, `#B8E5DE`, `#F06450`, and optional `#F2D3A2`.
- The icon contains no text, letters, date, watermark, external border, pre-rendered rounded corners, or transparency.
- The main subject stays inside a 12% safe boundary.
- Required files are exactly 1024, 512, 192, 180, and 32 pixels square.
- iOS title is `九州親子遊`; manifest start URL and scope are `/KYUSHU-FAMILY-2026/`.
- Existing Firebase authentication, synchronization, navigation, and GitHub Pages behavior must remain unchanged.
- User-owned untracked PDFs and standalone HTML must not be modified or committed.

---

### Task 1: Generate and approve the master icon

**Files:**
- Create: `assets/icons/fukuoka-app-icon-1024.png`

**Interfaces:**
- Produces: one opaque 1024 × 1024 PNG master consumed by Task 2.

- [ ] **Step 1: Generate the master with the built-in image tool**

Use this production prompt:

```text
Use case: logo-brand
Asset type: iPhone home-screen app icon master, square 1024 by 1024
Primary request: Create a polished minimalist icon called "Sea Breeze Fukuoka" for a Kyushu family trip app.
Subject: A simplified, unmistakable Fukuoka Tower centered vertically; a coral-red setting sun in the upper right without overlapping the tower; two clean curved Hakata Bay waves across the lower area.
Style/medium: flat geometric editorial illustration, crisp large shapes, high contrast, friendly premium family-travel mood.
Composition/framing: square edge-to-edge composition; all important shapes stay within a 12 percent safe margin; tower remains legible at 32 pixels.
Color palette: deep teal #12363D background, dark teal #0C2930, warm white tower #F7F1E8, aqua waves #69C9BD and #B8E5DE, coral sun #F06450, optional sand #F2D3A2.
Constraints: completely opaque square background; straight square corners; no text, letters, dates, logos, watermark, border, transparency, gradients that muddy small-size contrast, device mockup, pre-rendered rounded corners, shadow outside the artwork, or photographic detail.
```

Move the selected built-in output into `assets/icons/fukuoka-app-icon-1024.png`. Do not leave the project reference under `$CODEX_HOME/generated_images`.

- [ ] **Step 2: Inspect the master at full size**

Use the local image viewer and verify:

- Fukuoka Tower is centered and recognizable.
- Sun does not overlap the tower.
- Two wave layers are visible.
- Corners are solid deep teal.
- No text, watermark, transparency, or pre-rounded corners exist.

If one requirement fails, make one targeted image-generation edit and re-inspect.

- [ ] **Step 3: Verify master dimensions**

Run: `sips -g pixelWidth -g pixelHeight assets/icons/fukuoka-app-icon-1024.png`
Expected: width `1024`, height `1024`.

- [ ] **Step 4: Commit the approved master**

```bash
git add assets/icons/fukuoka-app-icon-1024.png
git commit -m "design: add Fukuoka app icon master"
```

---

### Task 2: Derive platform icon assets

**Files:**
- Create: `apple-touch-icon.png`
- Create: `icon-192.png`
- Create: `icon-512.png`
- Create: `favicon-32.png`
- Create: `tests/app-icon-assets.test.mjs`

**Interfaces:**
- Consumes: `assets/icons/fukuoka-app-icon-1024.png`.
- Produces: four optimized, opaque square PNG files.

- [ ] **Step 1: Write a failing asset contract test**

```js
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

function pngSize(bytes) {
  assert.equal(bytes.toString('ascii', 1, 4), 'PNG');
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

test('app icon PNGs exist at exact square sizes', async () => {
  for (const [path, size] of expected) {
    const dimensions = pngSize(await readFile(path));
    assert.deepEqual(dimensions, { width: size, height: size }, path);
  }
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/app-icon-assets.test.mjs`
Expected: FAIL because the derived assets do not exist.

- [ ] **Step 3: Resize from the master**

Use high-quality Lanczos resizing through the bundled Pillow runtime or native `sips`. Every output must keep the square aspect ratio and opaque deep-teal corners.

```bash
sips -z 180 180 assets/icons/fukuoka-app-icon-1024.png --out apple-touch-icon.png
sips -z 192 192 assets/icons/fukuoka-app-icon-1024.png --out icon-192.png
sips -z 512 512 assets/icons/fukuoka-app-icon-1024.png --out icon-512.png
sips -z 32 32 assets/icons/fukuoka-app-icon-1024.png --out favicon-32.png
```

- [ ] **Step 4: Inspect 180px and 32px outputs**

View `apple-touch-icon.png` and `favicon-32.png`. Confirm the tower, sun, and waves remain distinct at both sizes.

- [ ] **Step 5: Run and verify GREEN**

Run: `node --test tests/app-icon-assets.test.mjs`
Expected: PASS.

- [ ] **Step 6: Commit derived assets**

```bash
git add apple-touch-icon.png icon-192.png icon-512.png favicon-32.png tests/app-icon-assets.test.mjs
git commit -m "feat: add platform app icon assets"
```

---

### Task 3: Add manifest and iOS metadata

**Files:**
- Create: `manifest.webmanifest`
- Modify: `index.html`
- Modify: `scripts/build-app-bundle.mjs`
- Modify: `tests/index-integration.test.mjs`

**Interfaces:**
- Consumes: icon files from Task 2.
- Produces: install metadata in both the outer document and bundled inner document.

- [ ] **Step 1: Write failing manifest and HTML integration tests**

```js
test('website exposes Apple and PWA install metadata in both heads', async () => {
  const html = await readFile('index.html', 'utf8');
  const raw = html.match(/<script type="__bundler\/template">\s*([\s\S]*?)\s*<\/script>/)?.[1];
  const inner = JSON.parse(raw);
  for (const source of [html, inner]) {
    assert.match(source, /rel="apple-touch-icon"[^>]*apple-touch-icon\.png/);
    assert.match(source, /rel="manifest"[^>]*manifest\.webmanifest/);
    assert.match(source, /apple-mobile-web-app-title" content="九州親子遊"/);
    assert.match(source, /theme-color" content="#12363D"/);
  }
});

test('web manifest uses the GitHub Pages subpath and required icons', async () => {
  const manifest = JSON.parse(await readFile('manifest.webmanifest', 'utf8'));
  assert.equal(manifest.short_name, '九州親子遊');
  assert.equal(manifest.start_url, '/KYUSHU-FAMILY-2026/');
  assert.equal(manifest.scope, '/KYUSHU-FAMILY-2026/');
  assert.equal(manifest.display, 'standalone');
  assert.deepEqual(manifest.icons.map(({ src, sizes }) => [src, sizes]), [
    ['icon-192.png', '192x192'], ['icon-512.png', '512x512'],
  ]);
});
```

- [ ] **Step 2: Run and verify RED**

Run: `node --test tests/index-integration.test.mjs`
Expected: FAIL because manifest and install metadata are absent.

- [ ] **Step 3: Create `manifest.webmanifest`**

Use the exact JSON from the approved design specification, including `purpose: "any maskable"` for both icon entries.

- [ ] **Step 4: Update the deterministic bundle builder**

Add an idempotent helper that inserts the approved seven install tags into a `<head>` only when absent and throws when no unique head is found. Apply it to both the outer HTML and serialized inner template. Repeated builds must not duplicate tags.

- [ ] **Step 5: Rebuild and verify integration tests**

Run: `node scripts/build-app-bundle.mjs`
Expected: build completes without errors.

Run: `node --test tests/index-integration.test.mjs tests/app-icon-assets.test.mjs`
Expected: all tests PASS.

- [ ] **Step 6: Verify build idempotence**

Copy the built `index.html` to a temporary path, run the build again, and compare the two files.
Expected: byte-for-byte equality.

- [ ] **Step 7: Commit website integration**

```bash
git add manifest.webmanifest index.html scripts/build-app-bundle.mjs tests/index-integration.test.mjs
git commit -m "feat: enable Fukuoka home-screen icon"
```

---

### Task 4: Verify, publish, and hand off iPhone testing

**Files:**
- Modify only when a failing test requires a tested correction.

**Interfaces:**
- Produces: reviewed PR, merged GitHub Pages deployment, and iPhone installation instructions.

- [ ] **Step 1: Run full verification**

Run: `node --test tests/*.test.mjs`
Expected: zero failures.

Run: `git diff --check origin/main...HEAD`
Expected: no output.

Run: `node scripts/build-app-bundle.mjs` followed by a clean tracked diff check.
Expected: build is deterministic and introduces no uncommitted tracked changes.

- [ ] **Step 2: Run local browser checks**

Serve the repository locally and verify:

- `apple-touch-icon.png`, `favicon-32.png`, `icon-192.png`, `icon-512.png`, and `manifest.webmanifest` return HTTP 200.
- Outer and rendered inner heads expose the expected tags.
- Existing Google login and Firebase synchronization still reach `已同步`.

- [ ] **Step 3: Request whole-branch code and visual review**

The reviewer checks the complete branch against the design, including icon safe area, small-size legibility, manifest paths, bundle idempotence, and test evidence. Fix all Critical and Important findings before publishing.

- [ ] **Step 4: Push, open, and merge a pull request**

Push `feature/fukuoka-app-icon`, create a PR against `main`, merge only after final review, and retain user-owned untracked files.

- [ ] **Step 5: Verify GitHub Pages**

Confirm the Pages workflow builds the merge commit. Fetch all five icon files and the manifest from `https://mihsia.github.io/KYUSHU-FAMILY-2026/` and verify HTTP 200, content types, and dimensions.

- [ ] **Step 6: iPhone Safari handoff**

Ask the user to delete the old home-screen shortcut, reopen the site in Safari, and choose `分享 → 加入主畫面`. Verify the preview icon, title `九州親子遊`, standalone launch, Google login, and Firebase synchronization.
