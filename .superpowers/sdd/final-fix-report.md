# Final whole-branch review fixes

## Scope

- Expense TWD totals now use the confirmed shared BOT rate in hundred-JPY units: `this.state.rate / 100`.
- Receipt deletion treats Firebase Storage `storage/object-not-found` as an already-completed step and resumes Firestore deletion. Other Storage failures still stop before Firestore deletion and retain the expense record.
- Bundle rewriting now matches the unique rate save `<button>` block, normalizes its disabled state and label only inside that block, and errors unless exactly one block is found.

## TDD evidence

### RED

Command:

```text
/Users/eric/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/app-source-contract.test.mjs tests/firebase-browser-contract.test.mjs
```

Result: 15 tests, 12 passed, 3 failed. The expected failures were:

- `expense TWD total uses the confirmed shared BOT rate units`
- `bundle builder scopes rate button changes to one exact button block`
- `browser service exposes receipt-aware expense operations in safe order`

### GREEN

After the minimal implementation and bundle rebuild:

```text
/Users/eric/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node scripts/build-app-bundle.mjs
/Users/eric/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/app-source-contract.test.mjs tests/firebase-browser-contract.test.mjs tests/index-integration.test.mjs
```

Result: 20 tests, 20 passed, 0 failed.

## Files changed

- `src/app.jsx`
- `firebase-family.js`
- `scripts/build-app-bundle.mjs`
- `tests/app-source-contract.test.mjs`
- `tests/firebase-browser-contract.test.mjs`
- `index.html` (deterministically rebuilt app bundle)
- `.superpowers/sdd/final-fix-report.md`

## Final verification

- `node --check firebase-family.js`: passed.
- `node --check scripts/build-app-bundle.mjs`: passed.
- Repeated `node scripts/build-app-bundle.mjs` followed by `cmp` against the prior rebuilt `index.html`: passed with no changes.
- Full suite `node --test tests/*.mjs`: 34 tests, 34 passed, 0 failed.
- `git diff --check`: passed with no whitespace errors.
- Diff stat before this report: 6 files, 31 insertions, 11 deletions.

## Self-review

- Confirmed the expense conversion uses the same rate units as the converter (`rate / 100`) and removed the hard-coded `0.214` path.
- Confirmed Storage deletion remains before Firestore deletion; only `storage/object-not-found` continues, while all other Storage failures throw before `deleteDoc`.
- Confirmed the bundle replacement is scoped by the save-rate button marker and its button boundaries, supports both prebuilt and already-built label/disabled variants, requires exactly one match, and is idempotent.
- No deployment, push, external-system mutation, PDF, or standalone HTML was added.

## Concerns

None. The retry behavior is covered by a focused source contract; live Firebase was intentionally not touched.
