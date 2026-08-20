# Deconstruction Share Links Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 공유 button to each deconstruction result strategy card that copies a self-contained link; opening the link re-runs the deterministic analysis and highlights the shared strategy (~5s fade).

**Architecture:** Snapshot builder `collectDeconState` extracted from `saveDeconTransferSession`; new pure codec module `src/lib/deconstruction/shareLink.mjs` (`?s=` = base64url(gzip(JSON({v:1,…state,strategyIndex}))), raw-JSON fallback for old browsers); `restoreDeconState(state, {share, highlightStrategyIndex})` extracted from `tryRestoreDeconSession` so both back-navigation and share links restore through the same code; share path re-runs `runAnalysis()` (engine is deterministic) then paginates to `floor(si/5)+1`, pulses the card, and strips `?s` via `history.replaceState`.

**Tech Stack:** Astro page script (vanilla JS), Node ≥22 globals (`CompressionStream`/`DecompressionStream`/`Blob`/`Response` — available in `node --test`), `node:test` for unit tests, existing `src/lib/beacon.mjs` analytics.

**Spec:** `docs/superpowers/specs/2026-08-19-decon-share-design.md` (approved 2026-08-19).

**Test baseline:** `npm test` fails 43/406 on a clean tree — those 43 are pre-existing (see memory `test-baseline-43-failures`). Only NEW failures are a problem; new passing tests are expected.

**Deviation from spec:** the encode/decode helpers live in `src/lib/deconstruction/shareLink.mjs` (not inline in `deconstruction.astro`) because unit tests need them DOM-free — same pattern as the existing `pagination.mjs`/`resultFilters.mjs` extraction. Spec behavior is unchanged.

---

### Task 1: Extract `collectDeconState` snapshot builder

**Files:**
- Create: `tests/decon-session-state.test.mjs`
- Modify: `src/lib/deconSessionState.mjs:136-200` (`saveDeconTransferSession`)

- [ ] **Step 1: Write the failing test**

Create `tests/decon-session-state.test.mjs` — starting with a global stub, because bare Node has no `HTMLInputElement` and `instanceof` throws `ReferenceError` without it (same mock-globals-before-imports convention as `tests/persistence.test.mjs`):

```js
globalThis.HTMLInputElement = class HTMLInputElement {};

import assert from 'node:assert/strict';
import test from 'node:test';
import { collectDeconState } from '../src/lib/deconSessionState.mjs';

const buildOpts = (overrides = {}) => ({
  selectedItem: { id: 1001, nameKo: '테스트 무기' },
  itemNameInput: null, // not an input → falls back to item name
  deconDeltas: { str: 25 },
  deconStatKeys: ['str'],
  deconStatMode: 'add',
  slotState: { successfulScrollCount: 3, remainingSlots: 5, maxSlots: 8 },
  totalAppliedScrolls: 4,
  appliedLevelCount: 1,
  scrollRateFilter: new Set(['100', '60']),
  stimulantBoundsMap: new Map([['str', { min: -10, max: 10 }]]),
  stimulantEnabledKeys: ['str'],
  chaosBoundsMap: new Map(),
  chaosEnabledKeys: [],
  gemFilter: new Set([1, 2]),
  levelUpTotalRanges: { str: { min: 1, max: 3 } },
  getCheckedTargetKeys: () => ['str', 'dex'],
  sourceInputs: { scrolls: null, stimulant: null, gems: null, itemLevelUp: null },
  ...overrides,
});

test('collectDeconState builds the snapshot shape share links use', () => {
  const snapshot = collectDeconState(buildOpts());

  assert.equal(snapshot.itemId, 1001);
  assert.equal(snapshot.itemName, '테스트 무기');
  assert.deepEqual(snapshot.deconDeltas, { str: 25 });
  assert.deepEqual(snapshot.deconStatKeys, ['str']);
  assert.equal(snapshot.deconStatMode, 'add');
  assert.equal(snapshot.successfulScrollCount, 3);
  assert.equal(snapshot.remainingSlots, 5);
  assert.equal(snapshot.maxSlots, 8);
  assert.equal(snapshot.totalAppliedScrolls, 4);
  assert.equal(snapshot.appliedLevelCount, 1);
  assert.deepEqual(snapshot.scrollRateFilter, ['100', '60']);
  assert.deepEqual(snapshot.stimulantBoundsMap, new Map([['str', { min: -10, max: 10 }]]));
  assert.deepEqual(snapshot.stimulantEnabledKeys, ['str']);
  assert.deepEqual(snapshot.gemFilter, [1, 2]);
  assert.deepEqual(snapshot.levelUpTotalRanges, { str: { min: 1, max: 3 } });
  assert.deepEqual(snapshot.targetKeys, ['str', 'dex']);
  assert.deepEqual(snapshot.sourceChecked, {
    scrolls: false,
    stimulant: false,
    gems: false,
    itemLevelUp: false,
  });
  // Share payloads must not carry scrollPosition (meaningless to the recipient)
  assert.ok(!('scrollPosition' in snapshot));
});

test('collectDeconState clones mutable inputs', () => {
  const deconDeltas = { str: 1 };
  const scrollRateFilter = new Set(['100']);
  const gemFilter = new Set([7]);
  const snapshot = collectDeconState(
    buildOpts({ deconDeltas, scrollRateFilter, gemFilter }),
  );

  deconDeltas.str = 99;
  scrollRateFilter.add('60');
  gemFilter.add(8);

  assert.equal(snapshot.deconDeltas.str, 1);
  assert.deepEqual(snapshot.scrollRateFilter, ['100']);
  assert.deepEqual(snapshot.gemFilter, [7]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/decon-session-state.test.mjs`
Expected: FAIL — `collectDeconState` is not exported.

- [ ] **Step 3: Extract the snapshot builder**

In `src/lib/deconSessionState.mjs`, replace the whole `saveDeconTransferSession` function (lines 110-200, from the JSDoc block `/** Build and persist…` through the closing `}` before end of file) with:

```js
/**
 * Build a serialisable snapshot of the deconstruction page state — the shape
 * shared by sessionStorage auto-save and share links.
 *
 * All mutable state (Sets, Maps, objects) is shallow-cloned before storage
 * so later mutations don't corrupt the saved snapshot.
 *
 * `scrollPosition` is deliberately excluded — it is session-local only and
 * meaningless to a share-link recipient.
 *
 * @param {object} opts
 * @param {object} opts.selectedItem - currently selected item
 * @param {HTMLInputElement|null} opts.itemNameInput - item name input
 * @param {Record<string,number>} opts.deconDeltas - stat delta map
 * @param {string[]} opts.deconStatKeys - active stat keys
 * @param {'add'|'sum'} opts.deconStatMode - stat editor input mode
 * @param {{successfulScrollCount:number,remainingSlots:number,maxSlots:number}} opts.slotState
 * @param {number} opts.totalAppliedScrolls - successful + inferred failed
 * @param {number} opts.appliedLevelCount - item level-up count
 * @param {Set<string>} opts.scrollRateFilter - active rate filter
 * @param {Map} opts.stimulantBoundsMap - stimulant bounds
 * @param {string[]} opts.stimulantEnabledKeys
 * @param {Map} opts.chaosBoundsMap - chaos bounds
 * @param {string[]} opts.chaosEnabledKeys
 * @param {Set<number>|null} opts.gemFilter
 * @param {Record<string,{min:number,max:number}>} opts.levelUpTotalRanges
 * @param {() => string[]} opts.getCheckedTargetKeys
 * @param {{scrolls:HTMLInputElement,stimulant:HTMLInputElement,gems:HTMLInputElement,itemLevelUp:HTMLInputElement}} opts.sourceInputs
 * @returns {object} serialisable snapshot
 */
export function collectDeconState({
  selectedItem,
  itemNameInput,
  deconDeltas,
  deconStatKeys,
  deconStatMode,
  slotState,
  totalAppliedScrolls,
  appliedLevelCount,
  scrollRateFilter,
  stimulantBoundsMap,
  stimulantEnabledKeys,
  chaosBoundsMap,
  chaosEnabledKeys,
  gemFilter,
  levelUpTotalRanges,
  getCheckedTargetKeys,
  sourceInputs,
}) {
  return {
    itemId: selectedItem.id,
    itemName:
      itemNameInput instanceof HTMLInputElement ? itemNameInput.value : (selectedItem.nameKo ?? ''),
    deconDeltas: { ...deconDeltas },
    deconStatKeys: [...deconStatKeys],
    deconStatMode,
    successfulScrollCount: slotState.successfulScrollCount,
    remainingSlots: slotState.remainingSlots,
    maxSlots: slotState.maxSlots,
    totalAppliedScrolls,
    appliedLevelCount,
    scrollRateFilter: [...scrollRateFilter],
    stimulantBoundsMap: structuredClone(stimulantBoundsMap),
    stimulantEnabledKeys: [...stimulantEnabledKeys],
    chaosBoundsMap: structuredClone(chaosBoundsMap),
    chaosEnabledKeys: [...chaosEnabledKeys],
    gemFilter: gemFilter instanceof Set ? [...gemFilter] : null,
    levelUpTotalRanges: structuredClone(levelUpTotalRanges),
    targetKeys: getCheckedTargetKeys(),
    sourceChecked: {
      scrolls:
        sourceInputs.scrolls instanceof HTMLInputElement ? sourceInputs.scrolls.checked : false,
      stimulant:
        sourceInputs.stimulant instanceof HTMLInputElement ? sourceInputs.stimulant.checked : false,
      gems: sourceInputs.gems instanceof HTMLInputElement ? sourceInputs.gems.checked : false,
      itemLevelUp:
        sourceInputs.itemLevelUp instanceof HTMLInputElement
          ? sourceInputs.itemLevelUp.checked
          : false,
    },
  };
}

/**
 * Build and persist a full deconstruction-page snapshot for back-navigation
 * restoration.  Used by the transfer-payload handler and other save points.
 *
 * @param {object} opts - same shape as collectDeconState (see its JSDoc)
 */
export function saveDeconTransferSession(opts) {
  saveDeconSession({
    ...collectDeconState(opts),
    scrollPosition: window.scrollY,
  });

  // Save the heavy result payload to a separate key — best-effort only.
  // If the result exceeds the sessionStorage quota, the lightweight draft
  // state (saved above) is unaffected.
  const result = window.__lastDeconResult;
  if (result) {
    try {
      sessionStorage.setItem(RESULT_KEY, JSON.stringify({ v: 1, result }));
    } catch {
      // quota exceeded — draft state already saved, silently ok
    }
  }
}
```

Note: `saveDeconTransferSession(opts)` now takes the opts object it already received — the two call sites in `deconstruction.astro` (lines ~2066 and ~2906) need NO changes; their object literals are exactly the opts shape.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test tests/decon-session-state.test.mjs tests/persistence.test.mjs`
Expected: PASS (persistence test imports only `saveDeconSession`/`loadDeconSession`/`clearDeconSession`, so it must stay green).

- [ ] **Step 5: Commit**

```bash
git add src/lib/deconSessionState.mjs tests/decon-session-state.test.mjs
git commit -m "refactor: extract collectDeconState from saveDeconTransferSession"
```

---

### Task 2: Share-link codec (`shareLink.mjs`) + tests

**Files:**
- Create: `src/lib/deconstruction/shareLink.mjs`
- Create: `tests/decon-share-link.test.mjs`
- Modify: `package.json:31` (`test:unit` list)

- [ ] **Step 1: Write the failing test**

Create `tests/decon-share-link.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeShareLink, decodeShareLink } from '../src/lib/deconstruction/shareLink.mjs';

// Raw (uncompressed) payload builder — mimics the old-browser fallback format.
const toBase64Url = (json) =>
  btoa(unescape(encodeURIComponent(json))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

const SNAPSHOT = {
  itemId: 1001,
  itemName: '테스트 무기',
  deconDeltas: { str: 25 },
  deconStatKeys: ['str'],
  deconStatMode: 'add',
  successfulScrollCount: 3,
  remainingSlots: 5,
  maxSlots: 8,
  totalAppliedScrolls: 4,
  appliedLevelCount: 1,
  scrollRateFilter: ['100', '60'],
  stimulantBoundsMap: { str: { min: -10, max: 10 } },
  stimulantEnabledKeys: ['str'],
  chaosBoundsMap: {},
  chaosEnabledKeys: [],
  gemFilter: [1, 2],
  levelUpTotalRanges: { str: { min: 1, max: 3 } },
  targetKeys: ['str', 'dex'],
  sourceChecked: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
};

test('encode → decode round-trips state and strategyIndex', async () => {
  const payload = await encodeShareLink(SNAPSHOT, 3);
  assert.equal(typeof payload, 'string');
  assert.ok(payload.length > 0);

  const decoded = await decodeShareLink(payload);
  assert.equal(decoded.v, 1);
  assert.equal(decoded.strategyIndex, 3);
  for (const [key, value] of Object.entries(SNAPSHOT)) {
    assert.deepEqual(decoded[key], value, `key ${key} must round-trip`);
  }
});

test('gzipped payload stays well under a 2 KB URL budget', async () => {
  const payload = await encodeShareLink(SNAPSHOT, 0);
  assert.ok(payload.length < 2000, `payload was ${payload.length} chars`);
});

test('decode accepts uncompressed payloads (old-browser fallback)', async () => {
  const payload = toBase64Url(JSON.stringify({ v: 1, ...SNAPSHOT, strategyIndex: 2 }));
  const decoded = await decodeShareLink(payload);
  assert.equal(decoded.strategyIndex, 2);
  assert.equal(decoded.itemId, 1001);
});

test('decode rejects garbage', async () => {
  assert.equal(await decodeShareLink('!!!not-base64!!!'), null);
});

test('decode rejects unknown version', async () => {
  const payload = toBase64Url(JSON.stringify({ v: 2, itemId: 1, strategyIndex: 0 }));
  assert.equal(await decodeShareLink(payload), null);
});

test('decode rejects payloads without itemId', async () => {
  const payload = toBase64Url(JSON.stringify({ v: 1, strategyIndex: 0 }));
  assert.equal(await decodeShareLink(payload), null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/decon-share-link.test.mjs`
Expected: FAIL — cannot find module `../src/lib/deconstruction/shareLink.mjs`.

- [ ] **Step 3: Write the codec**

Create `src/lib/deconstruction/shareLink.mjs`:

```js
/**
 * Self-contained share-link codec for deconstruction results.
 *
 * Link format (?s= param):
 *   base64url(gzip(JSON({ v:1, ...state, strategyIndex })))
 *
 * When CompressionStream is unavailable (old Safari), encode falls back to
 * uncompressed raw JSON base64url — functionally identical, just longer.
 * decode transparently accepts both: it tries gzip first, then raw JSON.
 */

const VERSION = 1;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(payload) {
  const b64 = payload
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(payload.length / 4) * 4, '=');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encode a deconstruction state snapshot + strategy index into a `?s=` payload.
 *
 * @param {object} state - collectDeconState() snapshot
 * @param {number} strategyIndex - index of the strategy to highlight
 * @returns {Promise<string>} base64url payload (no padding)
 */
export async function encodeShareLink(state, strategyIndex) {
  const json = JSON.stringify({ v: VERSION, ...state, strategyIndex });
  if (typeof CompressionStream === 'function') {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressed = await new Response(stream).arrayBuffer();
    return bytesToBase64Url(new Uint8Array(compressed));
  }
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/**
 * Decode a `?s=` payload back into a state snapshot.
 *
 * @param {string|null} payload - the ?s= query value
 * @returns {Promise<object|null>} decoded state (+ strategyIndex), or null if
 *   absent, corrupt, wrong version, or missing itemId
 */
export async function decodeShareLink(payload) {
  if (!payload) return null;
  // Cap input size before decompressing attacker-controlled payloads.
  // gzip can amplify ~1000x (measured); legit links are <2 KB, so 16 KB
  // bounds worst-case expansion to ~16 MB and rejects nothing real.
  if (payload.length > 16000) return null;
  try {
    const bytes = base64UrlToBytes(payload);
    let json;
    if (typeof DecompressionStream === 'function') {
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        json = await new Response(stream).text();
      } catch {
        // Not gzip — fall back to raw JSON (uncompressed link)
        json = new TextDecoder().decode(bytes);
      }
    } else {
      json = new TextDecoder().decode(bytes);
    }
    const data = JSON.parse(json);
    if (!data || data.v !== VERSION || !data.itemId) return null;
    return data;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/decon-share-link.test.mjs`
Expected: PASS (7/7 — includes the CompressionStream-absent fallback test added during review: stub `globalThis.CompressionStream = undefined`, encode, round-trip; `node --test` isolates files per process so the global mutation is safe).

- [ ] **Step 5: Register both new test files in `test:unit`**

In `package.json`, the `test:unit` script currently ends with `… tests/scroll-status-review.test.mjs"`. Replace the tail:

```
tests/scroll-status-review.test.mjs"
```

with:

```
tests/scroll-status-review.test.mjs tests/decon-session-state.test.mjs tests/decon-share-link.test.mjs"
```

- [ ] **Step 6: Run the unit suite**

Run: `npm run test:unit`
Expected: 211 tests with 6 pre-existing failures (5 in `deconstruction-result-filter-controller.test.mjs`, 1 in `deconstruction-result-filters.test.mjs` — baseline, not from this change); the 2 new files contribute 9 passing tests (3 + 6). Compare failure names, not counts.

- [ ] **Step 7: Commit**

```bash
git add src/lib/deconstruction/shareLink.mjs tests/decon-share-link.test.mjs package.json
git commit -m "feat: add share-link codec for deconstruction results"
```

---

### Task 3: Expose `goToPage` on the pagination controller

**Files:**
- Modify: `src/lib/deconstruction/pagination.mjs:16-20` (JSDoc) and `:153` (return)

No new test: this is a one-line exposure of an existing internal function; pagination is DOM-coupled and the repo has no DOM test infrastructure.

- [ ] **Step 1: Expose `goToPage`**

In `src/lib/deconstruction/pagination.mjs`, update the JSDoc return type (lines 16-20):

```js
 * @returns {{ renderBar: () => void, applyPagination: (isFilterUpdate?: boolean) => void,
 *   resetPage: () => void, goToPage: (page: number) => void }}
```

and replace the return statement (line 153):

```js
  return { renderBar, applyPagination: _applyPagination, resetPage };
```

with:

```js
  return { renderBar, applyPagination: _applyPagination, resetPage, goToPage: _goToPage };
```

(`_goToPage` already clamps `page` to `[1, totalPages]` internally — callers can pass an out-of-range strategy page safely.)

- [ ] **Step 2: Verify the controller surface**

Run: `node -e "import('./src/lib/deconstruction/pagination.mjs').then((m) => console.log(Object.keys(m.createPagination('#x')).sort().join(',')))"`
Expected: `applyPagination,goToPage,renderBar,resetPage`

- [ ] **Step 3: Commit**

```bash
git add src/lib/deconstruction/pagination.mjs
git commit -m "feat: expose goToPage on deconstruction pagination controller"
```

---

### Task 4: Extract `restoreDeconState` and wire the share-restore gate

**Files:**
- Modify: `src/pages/deconstruction.astro` (imports `:493-500` and after `:549`; helpers before `:1954`; transfer handler `:2066-2089`; restore block `:2676-2799`; gate `:2801-2809`; pagehide handler `:2902-2929`)

All steps here are DOM-page wiring — unit coverage comes from Tasks 1-2 (snapshot + codec) plus the manual verification in Task 6. No new unit tests.

Note (from Task 2 review): `loadDeconSession` accepts `v >= 1` while `decodeShareLink` is strict `v === 1` — a harmless pre-existing inconsistency (different stores: sessionStorage vs URL; we control both encoders). Do NOT "fix" it here — it would also change session-restore behavior, and the pre-existing `persistence.test.mjs` failure ("rejects wrong version payload") relates to it.

- [ ] **Step 1: Update imports**

Replace the `deconSessionState` import (lines 493-500):

```js
  import {
    saveDeconSession,
    loadDeconSession,
    clearDeconSession,
    saveDeconTransferSession,
    loadDeconResult,
    clearDeconResult,
  } from '../lib/deconSessionState.mjs';
```

with:

```js
  import {
    saveDeconSession,
    loadDeconSession,
    clearDeconSession,
    saveDeconTransferSession,
    collectDeconState,
    loadDeconResult,
    clearDeconResult,
  } from '../lib/deconSessionState.mjs';
```

And add a new import directly after the `createPagination` import (line 549):

```js
  import { encodeShareLink, decodeShareLink } from '../lib/deconstruction/shareLink.mjs';
```

- [ ] **Step 2: Add share helpers before `displayResults`**

Insert directly before the `// ---- Display results ----` comment (line 1953):

```js
  // ---- Share helpers ----

  /**
   * Build the opts object consumed by collectDeconState for every save/share
   * path on this page (transfer button, pagehide auto-save, share button).
   */
  const buildSessionSnapshotOpts = () => ({
    selectedItem,
    itemNameInput,
    deconDeltas,
    deconStatKeys,
    deconStatMode,
    slotState: deconSlotState,
    totalAppliedScrolls:
      deconSlotState.successfulScrollCount + inferFailedScrollCount(deconSlotState),
    appliedLevelCount: deconAppliedLevelCount,
    scrollRateFilter: deconScrollRateFilter,
    stimulantBoundsMap: deconStimulantBoundsMap,
    stimulantEnabledKeys: deconStimulantEnabledKeys,
    chaosBoundsMap: deconChaosBoundsMap,
    chaosEnabledKeys: deconChaosEnabledKeys,
    gemFilter: deconGemFilter,
    levelUpTotalRanges: deconLevelUpTotalRanges,
    getCheckedTargetKeys,
    sourceInputs: {
      scrolls: deconScrollSource,
      stimulant: deconStimulantSource,
      gems: deconGemsSource,
      itemLevelUp: deconItemLevelUpSource,
    },
  });

  /**
   * Copy text to the clipboard.  Prefers navigator.clipboard in secure
   * contexts, falls back to a hidden textarea + execCommand('copy').
   * @returns {Promise<boolean>} true on success
   */
  const copyTextToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // fall through to the legacy path
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.append(ta);
      ta.select();
      const ok = document.execCommand('copy');
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  };
```

- [ ] **Step 3: Slim the transfer handler**

In `writeTransferPayload` (inside `displayResults`), replace the whole `saveDeconTransferSession({…})` call (currently lines 2066-2089) with:

```js
        saveDeconTransferSession(buildSessionSnapshotOpts());
```

(The `writeDeconTransfer(strategy, selectedItem.id, { totalAppliedScrolls })` line above it stays as-is.)

- [ ] **Step 4: Replace `tryRestoreDeconSession` with `restoreDeconState` + thin wrapper**

Replace the whole `const tryRestoreDeconSession = () => { … };` block (lines 2678-2799, from `const tryRestoreDeconSession` through the closing `};`) with:

```js
  const restoreDeconState = (saved, { share = false, highlightStrategyIndex = null } = {}) => {
    const item = itemById.get(saved.itemId);
    if (!item) return false; // item no longer in index — skip silently

    // 1. Restore item selection — commitSuggestedItem calls
    //    activateDeconEditPanel internally which sets up the panel
    //    with item defaults (slot state, stat keys, source config).
    //    Let commitSuggestedItem handle itemChanged naturally;
    //    saved state overrides run below and restore the actual values.
    commitSuggestedItem(item, { syncFilters: false });
    // Restore source checkboxes from saved session (instead of resetAllowedSources
    // which would wipe the user's calc config).  The build editors preserve
    // existing map entries so the restored bounds/keys survive the rebuild.
    const restoreSources = saved.sourceChecked ?? {};
    if (deconScrollSource instanceof HTMLInputElement)
      deconScrollSource.checked = restoreSources.scrolls ?? false;
    if (deconStimulantSource instanceof HTMLInputElement)
      deconStimulantSource.checked = restoreSources.stimulant ?? false;
    if (deconGemsSource instanceof HTMLInputElement)
      deconGemsSource.checked = restoreSources.gems ?? false;
    if (deconItemLevelUpSource instanceof HTMLInputElement)
      deconItemLevelUpSource.checked = restoreSources.itemLevelUp ?? false;
    updateLevelUpSourceEligibility();

    // Restore search input text
    if (itemNameInput instanceof HTMLInputElement) {
      itemNameInput.value = saved.itemName ?? item.nameKo;
    }

    // 2. Override item defaults with saved state (must run AFTER
    //    commitSuggestedItem / activateDeconEditPanel which resets
    //    these to defaults)
    deconDeltas = { ...(saved.deconDeltas ?? {}) };
    deconStatKeys = [...(saved.deconStatKeys ?? [])];
    deconStatMode = saved.deconStatMode === 'sum' ? 'sum' : 'add';
    syncDeconStatModeButtons();
    deconSlotState = createDeconstructionSlotState(saved.maxSlots ?? 0);
    deconSlotState = setSuccessfulScrollCount(deconSlotState, saved.successfulScrollCount ?? 0);
    deconSlotState = setRemainingSlotCount(
      deconSlotState,
      saved.remainingSlots ?? deconSlotState.maxSlots,
    );
    deconAppliedLevelCount = saved.appliedLevelCount ?? 0;

    // Restore source configuration
    deconScrollRateFilter = new Set(saved.scrollRateFilter ?? ['100', '60', '10']);
    deconStimulantBoundsMap = saved.stimulantBoundsMap ?? {};
    deconStimulantEnabledKeys = new Set(saved.stimulantEnabledKeys ?? []);
    deconChaosBoundsMap = saved.chaosBoundsMap ?? {};
    deconChaosEnabledKeys = new Set(saved.chaosEnabledKeys ?? []);
    deconGemFilter = new Set(saved.gemFilter ?? []);
    deconLevelUpTotalRanges = saved.levelUpTotalRanges ?? {};

    // Sync scroll-rate checkboxes to restored filter
    deconScrollRateInputs.forEach((inp) => {
      if (inp instanceof HTMLInputElement) {
        inp.checked = deconScrollRateFilter.has(inp.dataset.deconScrollRate);
      }
    });

    // 3. Re-render UI panels with restored values
    renderDeconSlotState();
    renderDeconItemLevel();
    rebuildStatEditor();
    updateTargetCard();
    renderSlots();
    checkStarState();
    updateAnalyzeButton();

    // Restore target chip checkmarks
    if (deconTargetChips instanceof HTMLElement && saved.targetKeys) {
      const targetKeySet = new Set(saved.targetKeys);
      const checkboxes = deconTargetChips.querySelectorAll('input[type="checkbox"]');
      checkboxes.forEach((cb) => {
        cb.checked = targetKeySet.has(cb.dataset.deconTargetKey);
      });
    }

    // Re-open source sub-panels that were checked in the saved session.
    // Because buildStimulantBoundsEditor / buildChaosBoundsEditor now
    // preserve existing map entries, the restored bounds survive the rebuild.
    if (restoreSources.scrolls) {
      toggleSourceSub(deconScrollSource, deconScrollRateSub);
    }
    if (restoreSources.stimulant) {
      toggleSourceSub(deconStimulantSource, deconStimulantBounds, () => {
        buildStimulantBounds();
        if (deconStimulantBounds instanceof HTMLElement) deconStimulantBounds.hidden = false;
      });
    }
    if (restoreSources.gems) {
      toggleSourceSub(deconGemsSource, deconGemSub, () => {
        buildGemFilter();
        if (deconGemSub instanceof HTMLElement) deconGemSub.hidden = false;
      });
    }
    if (restoreSources.itemLevelUp) {
      toggleSourceSub(deconItemLevelUpSource, deconLevelSlotRanges, () => {
        buildLevelUpEditors();
        if (deconLevelSlotRanges instanceof HTMLElement) deconLevelSlotRanges.hidden = false;
      });
    }

    // 4. Results — share links re-run the deterministic engine (the recipient
    //    gets the same strategies in the same order, so strategyIndex stays
    //    valid); back-navigation reuses the cached result payload.
    if (share) {
      runAnalysis();
      // Drop ?s from the URL so a refresh does not re-highlight.
      const url = new URL(location.href);
      url.searchParams.delete('s');
      history.replaceState(null, '', url.pathname + url.search);
    } else {
      const deconResult = saved.result ?? loadDeconResult();
      clearDeconResult();
      if (deconResult && deconResult.strategies?.length > 0) {
        const targetDeltas = {};
        for (const key of saved.targetKeys ?? []) {
          targetDeltas[key] = saved.deconDeltas?.[key] ?? 0;
        }
        displayResults(deconResult, targetDeltas);
      }
    }

    // 5. Position — share links jump to the shared card's page and pulse it
    //    (~5s CSS animation, class removed on animationend); back-navigation
    //    restores the prior scroll position.  Out-of-range strategyIndex
    //    (or missing card) skips the highlight, results still show.
    if (share && Number.isInteger(highlightStrategyIndex)) {
      pagination.goToPage(Math.floor(highlightStrategyIndex / 5) + 1); // PAGE_SIZE is 5
      const card = document.querySelector(
        `.decon-strategy-card[data-strategy-index="${highlightStrategyIndex}"]`,
      );
      if (card instanceof HTMLElement) {
        card.classList.add('decon-strategy-card--shared');
        card.addEventListener(
          'animationend',
          () => card.classList.remove('decon-strategy-card--shared'),
          { once: true },
        );
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } else {
      requestAnimationFrame(() => {
        window.scrollTo(0, saved.scrollPosition ?? 0);
      });
    }
    return true;
  };

  const tryRestoreDeconSession = () => {
    const saved = loadDeconSession();
    if (!saved || saved.v !== 1 || !saved.itemId) return;
    restoreDeconState(saved);
  };
```

- [ ] **Step 5: Share-priority gate + lazy `?s=` decode**

Replace the gate block (lines 2801-2809):

```js
  // Data-load readiness tracking — both fetches must complete before restoration
  let _itemsLoaded = false;
  let _scrollsLoaded = false;

  const _maybeRestoreDeconSession = () => {
    if (_itemsLoaded && _scrollsLoaded) {
      tryRestoreDeconSession();
    }
  };
```

with:

```js
  // Data-load readiness tracking — both fetches must complete before restoration
  let _itemsLoaded = false;
  let _scrollsLoaded = false;

  // Share-link payload from ?s= — decoded lazily once; restoration waits on
  // the same data-load gate as session restoration.
  let _sharePayloadPromise = null;
  const _getSharePayload = () =>
    (_sharePayloadPromise ??= decodeShareLink(new URLSearchParams(location.search).get('s')));

  const _maybeRestoreDeconSession = async () => {
    if (!_itemsLoaded || !_scrollsLoaded) return;
    const sharePayload = await _getSharePayload();
    if (sharePayload) {
      // Share links win over sessionStorage state — a stale local session must
      // not override what the sender shared.
      const restored = restoreDeconState(sharePayload, {
        share: true,
        highlightStrategyIndex: Number.isInteger(sharePayload.strategyIndex)
          ? sharePayload.strategyIndex
          : null,
      });
      if (restored) {
        trackEvent('deconstruction_share_open');
        return;
      }
      // Unrestorable share link (e.g. item left the index) — treat as a normal
      // visit per spec: fall through to session restore, and drop ?s so a
      // refresh does not re-attempt the dead link.
      const url = new URL(location.href);
      url.searchParams.delete('s');
      history.replaceState(null, '', url.pathname + url.search);
    }
    tryRestoreDeconSession();
  };
```

(The four existing `_maybeRestoreDeconSession();` call sites in the fetch handlers stay unchanged — the function is still callable without awaiting.)

- [ ] **Step 6: Slim the pagehide auto-save**

Replace the pagehide handler body (lines 2902-2929):

```js
  addEventListener('pagehide', () => {
    if (!selectedItem) return;
    const totalScrolls =
      deconSlotState.successfulScrollCount + inferFailedScrollCount(deconSlotState);
    saveDeconTransferSession({
      selectedItem,
      itemNameInput,
      deconDeltas,
      deconStatKeys,
      slotState: deconSlotState,
      totalAppliedScrolls: totalScrolls,
      appliedLevelCount: deconAppliedLevelCount,
      scrollRateFilter: deconScrollRateFilter,
      stimulantBoundsMap: deconStimulantBoundsMap,
      stimulantEnabledKeys: deconStimulantEnabledKeys,
      chaosBoundsMap: deconChaosBoundsMap,
      chaosEnabledKeys: deconChaosEnabledKeys,
      gemFilter: deconGemFilter,
      levelUpTotalRanges: deconLevelUpTotalRanges,
      getCheckedTargetKeys,
      sourceInputs: {
        scrolls: deconScrollSource,
        stimulant: deconStimulantSource,
        gems: deconGemsSource,
        itemLevelUp: deconItemLevelUpSource,
      },
    });
  });
```

with:

```js
  addEventListener('pagehide', () => {
    if (!selectedItem) return;
    saveDeconTransferSession(buildSessionSnapshotOpts());
  });
```

- [ ] **Step 7: Lint the page**

Run: `npm run lint`
Expected: no errors in `src/pages/deconstruction.astro` (no new errors anywhere).

- [ ] **Step 8: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: restore deconstruction state from share links"
```

---

### Task 5: Share button on strategy cards + highlight CSS

**Files:**
- Modify: `src/pages/deconstruction.astro` (card header after `:2114`; CSS after `:4993`)

- [ ] **Step 1: Add the 공유 button to each card header**

Insert directly after the `headerRow.append(transferLink);` line (currently line 2114) inside the `result.strategies.forEach` loop:

```js
      const shareBtn = document.createElement('button');
      shareBtn.type = 'button';
      shareBtn.className = 'decon-share-btn';
      shareBtn.textContent = '공유';
      let revertTimer = null;
      shareBtn.addEventListener('click', async () => {
        if (!selectedItem) return;
        // encodeShareLink returns the ?s= payload only — assemble the FULL
        // URL (spec: https://paranpot.com/deconstruction/?s=<payload>) so the
        // copied string is a link a recipient can actually open.
        const payload = await encodeShareLink(
          collectDeconState(buildSessionSnapshotOpts()),
          strategyIndex,
        );
        const url = new URL(location.pathname, location.href);
        url.searchParams.set('s', payload);
        const ok = await copyTextToClipboard(url.href);
        shareBtn.textContent = ok ? '링크 복사됨' : '복사 실패';
        if (!ok) console.log('[decon-share] copy failed, URL:', url.href);
        clearTimeout(revertTimer);
        revertTimer = setTimeout(() => {
          shareBtn.textContent = '공유';
        }, 2000);
        announce(ok ? '링크가 복사되었습니다.' : '복사에 실패했습니다.');
        trackEvent('deconstruction_share', { strategyIndex });
      });
      headerRow.append(shareBtn);
```

- [ ] **Step 2: Add share-button and highlight CSS**

Insert directly after the `.decon-ev-transfer-btn:hover` block (currently ending at line 4993):

```css
  /* Group selector replaces the old standalone .decon-ev-transfer-btn block
     (review: the two buttons share identical styling; font: inherit matches
     .decon-page-btn). */
  :global(.decon-ev-transfer-btn, .decon-share-btn) {
    font: inherit; /* first — the shorthand resets anything declared after it */
    padding: 5px 12px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface-soft);
    color: var(--ink);
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 650;
    line-height: 1.3;
    white-space: nowrap;
    transition:
      background 0.15s,
      border-color 0.15s;
  }
  :global(.decon-ev-transfer-btn, .decon-share-btn):hover {
    background: var(--green);
    color: #fff;
    border-color: var(--green);
  }
  :global(.decon-ev-transfer-btn) {
    text-decoration: none;
  }
```

Then add a separate GLOBAL style block (Astro's documented `is:global` directive — keyframes cannot be reliably scoped and the class is added/removed from JS-generated DOM) immediately after the existing `</style>` tag near the end of `deconstruction.astro`:

```astro
<style is:global>
  /* Share-link highlight — single pulse that fades out over ~5s.
     Global because the class is applied to JS-generated cards and the
     keyframes must not be Astro-scoped. */
  .decon-strategy-card--shared {
    animation: decon-share-pulse 5s ease-out forwards;
  }
  @keyframes decon-share-pulse {
    0% {
      box-shadow: 0 0 0 3px var(--green);
    }
    100% {
      box-shadow: 0 0 0 3px transparent;
    }
  }
</style>
```

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: add share button and highlight pulse to deconstruction cards"
```

---

### Task 6: Full verification (suite + build + manual)

No code changes expected — this task proves the feature works end to end.

- [ ] **Step 1: Unit suite**

Run: `npm run test:unit`
Expected: PASS — includes the 2 new files (2 + 6 tests).

- [ ] **Step 2: Full suite against baseline**

Run: `npm test`
Expected: the usual 43 pre-existing failures, 0 new failures; the new test files add 8 passing tests.

- [ ] **Step 3: Production build (compile check for the Astro/CSS edits)**

Run: `npm run build:ci`
Expected: build completes; no error from the `:global(@keyframes …)` rule. (If it errors, apply the fallback from Task 5 Step 2 and re-run.)

- [ ] **Step 4: Manual end-to-end check**

Run: `npm run dev` and open the deconstruction page.

1. Run an analysis (pick an item, set target stats, click 분석 시작).
2. Click `공유` on the 3rd strategy card → button shows `링크 복사됨` for ~2s, then reverts to `공유`.
3. Open the copied URL in a NEW tab: the same item/inputs/stat deltas are restored, the analysis re-runs with the same results, the page lands on page 1 containing card #3, and that card pulses and fades over ~5s. After load, the URL no longer contains `?s=`.
4. Refresh the same tab → no re-highlight (the `?s` was stripped).
5. Open `https://…/deconstruction/?s=garbage` → normal page, no errors, no highlight.
6. Share a link, then visit it in a tab that already has a different saved deconstruction session → the share link wins (state matches the sender, not the stale session).

- [ ] **Step 5: Commit anything left**

If Steps 1-4 required fixes, commit them; otherwise nothing to commit — feature done.
