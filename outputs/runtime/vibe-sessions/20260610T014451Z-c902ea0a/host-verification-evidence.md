# Host Verification Evidence

## Changed Behavior
- Global UI theme now defines `--brand-dark: #018FC7`.
- Existing green/blue brand aliases resolve to `var(--brand-dark)`.
- Unprotected form/list/card-adjacent surfaces use the updated light blue support palette.
- Protected selected item card styling remains unchanged for `body > main > section:nth-child(2) > div > aside > div`.

## Failing-First Evidence
- Command: `node --test tests/ui-theme-contract.test.mjs`
- Result before implementation: failed because `src/layouts/BaseLayout.astro` did not contain `--brand-dark: #018FC7;`.
- Protected card subtest passed before implementation, confirming the untouched-design baseline.

## Green Verification
- Command: `node --test tests/ui-theme-contract.test.mjs`
- Result after implementation: passed 2 tests.
- Command: `npm run build`
- Result after implementation: Astro built 9 pages successfully.
- Command: `curl -s http://127.0.0.1:4321/ | rg "#018FC7|selected-item-card|#4d4c78|#c8c8d2"`
- Result after implementation: served page contains `#018FC7` and preserves protected selected-card CSS literals `#4d4c78` and `#c8c8d2`.

## UI Quality Mapping
- Structure Completeness: theme changes are limited to global tokens and unprotected UI surfaces.
- Interaction Feedback: active/toggled states continue to use `var(--green)`, now backed by `#018FC7`.
- State Coverage: hidden selected item card CSS remains present and unchanged.
- Design System Consistency: repeated unprotected `#fbfcfa` surfaces now share `--surface-soft`.
- Responsive Stability: no layout, grid, or media-query rules were changed.
- Spec Fidelity: protected selector design remains unchanged while the surrounding theme uses `#018FC7`.
