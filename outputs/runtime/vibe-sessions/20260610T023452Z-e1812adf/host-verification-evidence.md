# Host Verification Evidence

## Changed Behavior
- Added a bright/dark mode toggle button immediately before the Korean navigation links in `src/layouts/BaseLayout.astro`.
- Bright mode remains the explicit default through `<html lang="ko" data-theme="bright">`.
- The toggle updates `document.documentElement.dataset.theme`, `aria-pressed`, visible label text, and localStorage persistence.

## Failing-First Evidence
- Command: `node --test tests/ui-theme-contract.test.mjs`
- Result: failed before implementation.
- Failing assertion: `header exposes bright and dark mode toggle before Korean nav links`.
- Failure reason: `BaseLayout.astro` did not include `<html lang="ko" data-theme="bright">` or a `data-theme-toggle` button before `nav[aria-label="주요 메뉴"]`.

## Green Evidence
- Command: `node --test tests/ui-theme-contract.test.mjs`
- Result: passed after implementation, `3/3` tests passing.
- Command: `npm run build`
- Result: passed, Astro built `9` static pages.
- Command: `rg -n "data-theme|data-theme-toggle|data-theme-label|scrollbluepill-theme|주요 메뉴" dist/index.html`
- Result: passed, generated HTML contains `data-theme="bright"`, the toggle before the Korean nav, and the theme persistence script.

## Degraded Browser Check
- Intended command: `python3 /Users/andykim/.codex/skills/webapp-testing/scripts/with_server.py --server "npm run dev -- --host 127.0.0.1" --port 4321 --timeout 45 -- python3 .vibeskills/tmp/verify-theme-toggle.py`
- Result: blocked by missing Python `playwright` package.
- Fallback: source contract, production build, and generated HTML checks above.

## Existing Unrelated Failure
- Command: `node --test tests/*.test.mjs`
- Result: one unrelated existing failure remains in `tests/calculator-input-contract.test.mjs`.
- Failure reason: the test expects `수동 검색`, while the current `src/pages/index.astro` label is `필터 검색`.
