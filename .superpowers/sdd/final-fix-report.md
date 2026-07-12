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

---

## Final review remediation: removable drafts and Firestore bounds

### Outcome

- Added a clearly labeled per-row `移除此筆` action for every unsucceeded import draft. Removal is blocked for succeeded rows and while import is busy; remaining duplicate warnings are recomputed against saved expenses and the remaining drafts.
- Removed drafts are absent from the batch input and therefore cannot reach `createImportedExpense`.
- Aligned the client contract with Firestore's 10,000,000 limit for row amount, item quantity, item amount, and the final normalized JPY value after either JPY passthrough or TWD conversion.
- Added the generated outer-page head dependency on `receipt-import-core.js` and made bundle rebuilding preserve/inject both the dependency and the row action deterministically.

### RED evidence

Command:

```text
/Users/eric/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node --test tests/receipt-import-core.test.mjs tests/index-integration.test.mjs
```

Result: failed as expected because `removeImportDraft` was not exported, the generated outer head did not load `receipt-import-core.js`, and the import row template had no `移除此筆` action.

### GREEN evidence

- Focused core test after implementation: 17 tests, 17 passed, 0 failed.
- Focused core and integration test after bundle rebuild: 25 tests, 25 passed, 0 failed.
- Added exact-boundary coverage for JPY and TWD normalized values at 10,000,000, over-bound parser and normalization coverage, and assertions that invalid rows make zero create calls.
- Added a behavioral batch assertion proving a removed draft is never created.

### Final verification

- Full suite: `node --test tests/*.test.mjs` passed 60/60.
- Repeated `node scripts/build-app-bundle.mjs` followed by `cmp` against the preceding generated `index.html`: passed with no changes.
- `git diff --check`: passed.
- User-owned untracked PDFs and standalone HTML were not modified or staged.

### Concerns

None. Live Firebase was intentionally not called; contract, source, generated-template, and browser-head behavior are covered locally.
