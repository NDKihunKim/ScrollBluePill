# Source Pre-Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accordion-style secondary pre-filter options under each source checkbox in the deconstruction calculator, so users can restrict which scroll rates, stimulant stat ranges, and level-up stat ranges the engine considers.

**Architecture:** Three new optional parameters on `enumerateStrategies` (`scrollRateFilter`, `stimulantStatBounds`, `levelUpSlotStatRanges`) flow from UI state through `runAnalysis` into the engine. Accordion sub-options appear inline when parent sources are checked. All sources deselected by default.

**Tech Stack:** Astro page script, browser DOM APIs, Node.js built-in test runner.

---

## File Structure

- Modify `src/lib/deconstruction/engine.mjs` — scroll name parsing, scroll rate filtering, new `enumerateStrategies` params
- Modify `src/lib/deconstruction/sourceContributions.mjs` — `solveStimulantResidual` bounds, `enumerateItemLevelContributions` per-slot ranges
- Modify `src/lib/deconstruction/sourcePolicy.mjs` — `getDefaultSourceSelection` all-false
- Modify `src/pages/deconstruction.astro` — HTML accordion, CSS, JS state/wiring/events
- Modify `tests/deconstruction-engine.test.mjs` — engine unit tests
- Modify `tests/deconstruction-ui-contract.test.mjs` — UI contract tests

### Task 1: Engine Unit Tests for scrollRateFilter

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`

- [ ] **Step 1: Add the scroll rate filter tests**

Add these tests after the existing overflow tests (after line ~537):

```js
test('scrollRateFilter excludes non-matching rate scrolls', () => {
  const scrolls = [
    { id: 1001, nameKo: '힘 주문서 100%', behavior_type: 'fixed', stats: { str: 1 } },
    { id: 1002, nameKo: '힘 주문서 60%', behavior_type: 'fixed', stats: { str: 1 } },
    { id: 1003, nameKo: '힘 주문서 10%', behavior_type: 'fixed', stats: { str: 1 } },
  ];
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
    scrollRateFilter: new Set(['100']),
  });
  assert.ok(result.strategies.length > 0);
  for (const s of result.strategies) {
    assert.ok(s.scrolls.every(sc => sc.id === 1001));
  }
});

test('scrollRateFilter empty set returns no strategies', () => {
  const scrolls = [
    { id: 1001, nameKo: '힘 주문서 100%', behavior_type: 'fixed', stats: { str: 1 } },
  ];
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
    scrollRateFilter: new Set([]),
  });
  assert.equal(result.strategies.length, 0);
});

test('scrollRateFilter null preserves all scrolls (backward compat)', () => {
  const scrolls = [
    { id: 1001, nameKo: '힘 주문서 100%', behavior_type: 'fixed', stats: { str: 1 } },
    { id: 1002, nameKo: '힘 주문서 60%', behavior_type: 'fixed', stats: { str: 1 } },
  ];
  const withFilter = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
    scrollRateFilter: null,
  });
  const withoutFilter = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', scrolls]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
  });
  assert.equal(withFilter.strategies.length, withoutFilter.strategies.length);
});
```

- [ ] **Step 2: Run focused tests to verify RED**

```bash
node --test --test-name-pattern "scrollRateFilter" tests/deconstruction-engine.test.mjs
```

Expected: FAIL because `scrollRateFilter` is not yet a recognized parameter.

- [ ] **Step 3: Commit**

```bash
git add tests/deconstruction-engine.test.mjs
git commit -m "test: cover scrollRateFilter engine parameter"
```

### Task 2: Engine Unit Tests for stimulantStatBounds and levelUpSlotStatRanges

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`

- [ ] **Step 1: Add the stimulant bounds and level-up slot range tests**

Add these after the scrollRateFilter tests:

```js
test('stimulantStatBounds restricts stimulant outcomes', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 3 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 50,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: false, stimulant: true, gems: false, itemLevelUp: false },
    stimulantStatBounds: { str: { min: 2, max: 4 } },
  });
  assert.ok(result.strategies.length > 0);
  for (const s of result.strategies) {
    assert.ok(s.hasStimulant);
    assert.ok(s.stimulant.stats.str >= 2 && s.stimulant.stats.str <= 4,
      `stimulant str ${s.stimulant.stats.str} should be within [2,4]`);
  }
});

test('stimulantStatBounds outside default range is clamped', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 3 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 50,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: null,
    allowedSources: { scrolls: false, stimulant: true, gems: false, itemLevelUp: false },
    stimulantStatBounds: { str: { min: -100, max: 100 } },
  });
  for (const s of result.strategies) {
    if (s.hasStimulant) {
      assert.ok(s.stimulant.stats.str >= -5 && s.stimulant.stats.str <= 5);
    }
  }
});

test('levelUpSlotStatRanges overrides per-slot stat ranges', () => {
  const levelUpDef = { maxLevelUps: 2, statRanges: { str: { min: 0, max: 3 } } };
  const result = enumerateStrategies({
    targetDeltas: { str: 2 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: levelUpDef,
    allowedSources: { scrolls: false, stimulant: false, gems: false, itemLevelUp: true },
    alreadyAppliedLevels: 0,
    levelUpSlotStatRanges: [
      { str: { min: 1, max: 1 } },
      { str: { min: 1, max: 1 } },
    ],
  });
  for (const s of result.strategies) {
    if (s.hasItemLevelUp) {
      assert.equal(s.itemLevelUp.stats.str, 2);
    }
  }
});

test('levelUpSlotStatRanges missing slot falls back to definition', () => {
  const levelUpDef = { maxLevelUps: 2, statRanges: { str: { min: 0, max: 2 } } };
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    requiredLevel: 0,
    cleanStats: { str: 0 },
    scrollsByEquipmentKind: new Map([['Cape', []]]),
    levelUpDefinition: levelUpDef,
    allowedSources: { scrolls: false, stimulant: false, gems: false, itemLevelUp: true },
    alreadyAppliedLevels: 0,
    levelUpSlotStatRanges: [], // empty array: all slots fall back
  });
  assert.ok(result.strategies.length > 0);
});
```

- [ ] **Step 2: Run focused tests to verify RED**

```bash
node --test --test-name-pattern "stimulantStatBounds|levelUpSlotStatRanges" tests/deconstruction-engine.test.mjs
```

Expected: FAIL (parameters not yet recognized).

- [ ] **Step 3: Commit**

```bash
git add tests/deconstruction-engine.test.mjs
git commit -m "test: cover stimulantStatBounds and levelUpSlotStatRanges"
```

### Task 3: UI Contract Tests for Accordion Sub-Options

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Add contract tests**

Add these tests after the level stepper tests (after the `item level max boundary` test):

```js
test('source checkboxes deselected by default', () => {
  const sourceSectionStart = pageSource.indexOf('<fieldset class="decon-source-options"');
  const sourceSectionEnd = pageSource.indexOf('</fieldset>', sourceSectionStart);
  const sourceSection = pageSource.slice(sourceSectionStart, sourceSectionEnd);
  // Scroll checkbox exists but no checked attribute
  assert.match(sourceSection, /<input type="checkbox" data-decon-source="scrolls"\s*\/>/);
  assert.match(sourceSection, /<input type="checkbox" data-decon-source="stimulant"\s*\/>/);
  assert.match(sourceSection, /<input type="checkbox" data-decon-source="gems"\s*\/>/);
  assert.match(sourceSection, /<input type="checkbox" data-decon-source="itemLevelUp"\s*\/>/);
});

test('scroll rate sub-options exist with correct data attributes', () => {
  assert.match(pageSource, /data-decon-scroll-rate="100"/);
  assert.match(pageSource, /data-decon-scroll-rate="60"/);
  assert.match(pageSource, /data-decon-scroll-rate="10"/);
  assert.match(pageSource, /data-decon-scroll-rate="chaos"/);
  // All visible by default (no hidden on the sub-container for scrolls)
  assert.match(pageSource, /data-decon-scroll-rate-sub/);
});

test('stimulant stat bounds sub-options exist', () => {
  assert.match(pageSource, /data-decon-stimulant-bounds/);
  assert.match(pageSource, /data-decon-stimulant-bound-min/);
  assert.match(pageSource, /data-decon-stimulant-bound-max/);
});

test('level-up slot range editors exist', () => {
  assert.match(pageSource, /data-decon-level-slot-ranges/);
  assert.match(pageSource, /data-decon-level-slot\[/);
});

test('getDefaultSourceSelection returns all false', () => {
  assert.match(
    pageSource,
    /scrolls:\s*false,\s*\n\s*stimulant:\s*false,\s*\n\s*gems:\s*false,\s*\n\s*itemLevelUp:\s*false/,
  );
});

test('runAnalysis passes pre-filter params to engine', () => {
  const runAnalysisStart = pageSource.indexOf('const runAnalysis = () => {');
  const displayResultsStart = pageSource.indexOf('const displayResults = (', runAnalysisStart);
  const runAnalysisSource = pageSource.slice(runAnalysisStart, displayResultsStart);
  assert.match(runAnalysisSource, /scrollRateFilter:\s*deconScrollRateFilter\.size > 0 \? deconScrollRateFilter : null/);
  assert.match(runAnalysisSource, /stimulantStatBounds:\s*Object\.keys\(deconStimulantBounds\)/);
  assert.match(runAnalysisSource, /levelUpSlotStatRanges:\s*deconLevelUpSlotRanges\.length > 0/);
});
```

- [ ] **Step 2: Run focused tests to verify RED**

```bash
node --test --test-name-pattern "source checkboxes|scroll rate|stimulant stat|level-up slot|getDefaultSourceSelection|pre-filter params" tests/deconstruction-ui-contract.test.mjs
```

Expected: FAIL (UI not yet implemented).

- [ ] **Step 3: Commit**

```bash
git add tests/deconstruction-ui-contract.test.mjs
git commit -m "test: cover source pre-filter accordion UI contract"
```

### Task 4: Engine Implementation — scrollRateFilter

**Files:**
- Modify: `src/lib/deconstruction/engine.mjs`

- [ ] **Step 1: Add scroll name parsing and rate filtering**

Add this function after `isChaosScroll` (after line 24):

```js
function parseScrollRate(nameKo) {
  if (/혼돈|chaos/i.test(nameKo)) return 'chaos';
  const match = nameKo.match(/(\d+)%/);
  return match ? match[1] : null;
}

function filterScrollsByRate(scrolls, rateFilter) {
  if (!rateFilter || rateFilter.size === 0) return scrolls;
  return scrolls.filter((s) => {
    const rate = parseScrollRate(s.nameKo);
    return rate !== null && rateFilter.has(rate);
  });
}
```

- [ ] **Step 2: Add `scrollRateFilter` to `enumerateStrategies` params and apply filter**

Add `scrollRateFilter = null` to the destructured params (after `allowedSources,`):

```js
  scrollRateFilter = null,
```

In `enumerateExactCountScrollStates` call (around line 401), prepend filtering of scrolls before passing to the generator. Find:

```js
  const scrolls = scrollsByEquipmentKind.get(equipmentKind) ?? [];
```

Replace with:

```js
  const rawScrolls = scrollsByEquipmentKind.get(equipmentKind) ?? [];
  const scrolls = scrollRateFilter ? filterScrollsByRate(rawScrolls, scrollRateFilter) : rawScrolls;
```

Update the JSDoc above `enumerateStrategies`:

```js
 * @param {Set<string>|null}    opts.scrollRateFilter       Allowed scroll rates: '100','60','10','chaos' (null=all)
```

- [ ] **Step 3: Run focused tests to verify GREEN**

```bash
node --test --test-name-pattern "scrollRateFilter" tests/deconstruction-engine.test.mjs
```

Expected: all 3 tests PASS.

- [ ] **Step 4: Run all engine tests**

```bash
node --test tests/deconstruction-engine.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deconstruction/engine.mjs
git commit -m "feat: add scrollRateFilter parameter to enumerateStrategies"
```

### Task 5: Engine Implementation — stimulantStatBounds and levelUpSlotStatRanges

**Files:**
- Modify: `src/lib/deconstruction/sourceContributions.mjs`
- Modify: `src/lib/deconstruction/engine.mjs`

- [ ] **Step 1: Add `stimulantBounds` to `solveStimulantResidual`**

In `sourceContributions.mjs`, change the function signature from:

```js
export function solveStimulantResidual(residual, targetKeys, { isWeapon = true } = {}) {
```

To:

```js
export function solveStimulantResidual(residual, targetKeys, { isWeapon = true, bounds = null } = {}) {
```

And in the per-key loop, after the existing limit/step computation (lines 17-19), add bounds clamping. Replace:

```js
    const value = residual[key] || 0;
    const limit = HP_MP_KEYS.has(key) ? 50 : 5;
```

With:

```js
    const value = residual[key] || 0;
    const baseLimit = HP_MP_KEYS.has(key) ? 50 : 5;
    const boundRange = bounds?.[key];
    const effectiveMin = boundRange && Number.isFinite(boundRange.min)
      ? Math.max(-baseLimit, Math.min(baseLimit, boundRange.min))
      : -baseLimit;
    const effectiveMax = boundRange && Number.isFinite(boundRange.max)
      ? Math.max(-baseLimit, Math.min(baseLimit, boundRange.max))
      : baseLimit;
    if (value < effectiveMin || value > effectiveMax) return null;
```

And replace the subsequent limit check:
```js
    if (value < -limit || value > limit || value % step !== 0) return null;
```
With:
```js
    if (value < effectiveMin || value > effectiveMax || value % step !== 0) return null;
```

- [ ] **Step 2: Add `perSlotRanges` to `enumerateItemLevelContributions`**

In `sourceContributions.mjs`, change the function signature from:

```js
export function enumerateItemLevelContributions({ levelUpDefinition, targetKeys, bounds, alreadyAppliedLevels = 0 }) {
```

To:

```js
export function enumerateItemLevelContributions({ levelUpDefinition, targetKeys, bounds, alreadyAppliedLevels = 0, perSlotRanges = null }) {
```

Inside the loop body (around line 68), before using `oneLevel`, select the correct ranges for the current level:

Replace:
```js
  for (let levelCount = 1; levelCount <= remainingLevels; levelCount++) {
    const seen = new Map();
    for (const base of previous) {
      for (const outcome of oneLevel) {
```

With:
```js
  for (let levelCount = 1; levelCount <= remainingLevels; levelCount++) {
    const seen = new Map();
    const slotIndex = levelCount - 1;
    const slotRanges = perSlotRanges?.[slotIndex];
    const effectiveRanges = {};
    if (slotRanges) {
      for (const key of targetKeys) {
        const defRange = levelUpDefinition?.statRanges?.[key] ?? { min: 0, max: 0 };
        const slotRange = slotRanges[key];
        effectiveRanges[key] = {
          min: slotRange && Number.isFinite(slotRange.min)
            ? Math.max(defRange.min, Math.min(defRange.max, slotRange.min))
            : defRange.min,
          max: slotRange && Number.isFinite(slotRange.max)
            ? Math.max(defRange.min, Math.min(defRange.max, slotRange.max))
            : defRange.max,
        };
      }
    }
    const ranges = slotRanges ? effectiveRanges : (levelUpDefinition.statRanges ?? {});
    const levelOutcomes = enumerateRangeVectors(ranges, targetKeys);
    for (const base of previous) {
      for (const outcome of levelOutcomes) {
```

Replace the continuation (the rest of the inner loops):
```js
        const stats = addVectors(base.stats, outcome, targetKeys);
        if (levelCount === remainingLevels && !withinBounds(stats, bounds, targetKeys)) continue;
        seen.set(vectorKey(stats, targetKeys), { levelCount, stats });
      }
    }
```

(Note: this replaces `outcome` usage; the `oneLevel` variable at the top is no longer used in the per-slot path.)

- [ ] **Step 3: Add `stimulantStatBounds` and `levelUpSlotStatRanges` to `enumerateStrategies`**

Add to destructured params:

```js
  stimulantStatBounds = null,
  levelUpSlotStatRanges = null,
```

Pass `stimulantStatBounds` to all `solveStimulantResidual` calls. Each call currently passes `stimulantOpts`. Change each call's last argument from `stimulantOpts` to:

```js
{ ...stimulantOpts, bounds: stimulantStatBounds }
```

There are 4 call sites (lines ~448, ~498, ~517, ~559). Update each.

Pass `levelUpSlotStatRanges` to `enumerateItemLevelContributions`:

```js
  const itemLevelContributions = normalizedAllowedSources.itemLevelUp
    ? enumerateItemLevelContributions({
        levelUpDefinition,
        targetKeys,
        bounds: itemBounds,
        alreadyAppliedLevels,
        perSlotRanges: levelUpSlotStatRanges,
      })
    : [];
```

Update JSDoc:

```js
 * @param {object|null}        opts.stimulantStatBounds     Per-key min/max for stimulant (null=default -5/+5)
 * @param {Array<object>|null} opts.levelUpSlotStatRanges   Per-slot stat ranges for level-ups (null=use definition)
```

- [ ] **Step 4: Run all engine tests to verify GREEN**

```bash
node --test tests/deconstruction-engine.test.mjs
```

Expected: all tests PASS including the new ones.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deconstruction/sourceContributions.mjs src/lib/deconstruction/engine.mjs
git commit -m "feat: add stimulantStatBounds and levelUpSlotStatRanges engine params"
```

### Task 6: getDefaultSourceSelection Change

**Files:**
- Modify: `src/lib/deconstruction/sourcePolicy.mjs`

- [ ] **Step 1: Change defaults to all false**

Replace:
```js
export const getDefaultSourceSelection = () => ({
  scrolls: true,
  stimulant: false,
  gems: false,
  itemLevelUp: false,
});
```

With:
```js
export const getDefaultSourceSelection = () => ({
  scrolls: false,
  stimulant: false,
  gems: false,
  itemLevelUp: false,
});
```

- [ ] **Step 2: Run contract tests to verify the default test passes**

```bash
node --test --test-name-pattern "getDefaultSourceSelection" tests/deconstruction-ui-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/lib/deconstruction/sourcePolicy.mjs
git commit -m "fix: deselect all sources by default"
```

### Task 7: Deconstruction Page — Accordion HTML and CSS

**Files:**
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Replace the source fieldset HTML**

Replace the existing `<fieldset class="decon-source-options">` block (lines 239-259) with:

```html
            <fieldset class="decon-source-options" aria-describedby="decon-source-message">
              <legend>분석에 사용할 강화 유형</legend>
              <div class="decon-source-accordion">
                <!-- Scrolls -->
                <div class="decon-source-row">
                  <label class="ev-target-chip">
                    <input type="checkbox" data-decon-source="scrolls" />
                    <span class="ev-target-chip-label">주문서</span>
                  </label>
                  <div class="decon-source-sub" data-decon-scroll-rate-sub>
                    <span class="decon-source-sub-label">스크롤 등급:</span>
                    <label class="decon-rate-chip"><input type="checkbox" data-decon-scroll-rate="100" checked />100%</label>
                    <label class="decon-rate-chip"><input type="checkbox" data-decon-scroll-rate="60" checked />60%</label>
                    <label class="decon-rate-chip"><input type="checkbox" data-decon-scroll-rate="10" checked />10%</label>
                    <label class="decon-rate-chip"><input type="checkbox" data-decon-scroll-rate="chaos" checked />Chaos</label>
                  </div>
                </div>
                <!-- Stimulant -->
                <div class="decon-source-row">
                  <label class="ev-target-chip">
                    <input type="checkbox" data-decon-source="stimulant" />
                    <span class="ev-target-chip-label">촉진제</span>
                  </label>
                  <div class="decon-source-sub" data-decon-stimulant-bounds hidden>
                    <span class="decon-source-sub-label">스탯 범위:</span>
                    <div data-decon-stimulant-bounds-list></div>
                  </div>
                </div>
                <!-- Gems -->
                <div class="decon-source-row">
                  <label class="ev-target-chip">
                    <input type="checkbox" data-decon-source="gems" />
                    <span class="ev-target-chip-label">보석</span>
                  </label>
                  <div class="decon-source-sub" hidden></div>
                </div>
                <!-- Item Level-Up -->
                <div class="decon-source-row" data-decon-level-up-source hidden>
                  <label class="ev-target-chip">
                    <input type="checkbox" data-decon-source="itemLevelUp" />
                    <span class="ev-target-chip-label">레벨업</span>
                  </label>
                  <div class="decon-source-sub" data-decon-level-slot-ranges hidden>
                    <span class="decon-source-sub-label" data-decon-level-slot-label></span>
                    <div data-decon-level-slot-list></div>
                  </div>
                </div>
              </div>
            </fieldset>
```

- [ ] **Step 2: Add CSS for accordion**

Add after the existing `:global(.ev-target-chip)` block:

```css
.decon-source-row {
  margin-bottom: 8px;
}
.decon-source-row:last-child {
  margin-bottom: 0;
}
.decon-source-sub {
  margin-left: 28px;
  margin-top: 6px;
  padding: 6px 10px;
  border-left: 3px solid #3366ff;
  font-size: 0.84rem;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.decon-source-sub[hidden] {
  display: none;
}
.decon-source-sub-label {
  color: #aaa;
  font-size: 0.8rem;
}
:global(.decon-rate-chip) {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border: 1px solid #555;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.82rem;
  font-family: inherit;
}
:global(.decon-rate-chip) input {
  width: 14px;
  height: 14px;
  accent-color: #3366ff;
}
:global(.decon-rate-chip):has(input:not(:checked)) {
  border-color: #444;
  opacity: 0.6;
}
.decon-level-slot {
  background: #1e1e24;
  border-radius: 6px;
  padding: 6px 10px;
  margin: 4px 0;
  width: 100%;
}
.decon-level-slot-label {
  font-weight: 600;
  font-size: 0.8rem;
  color: #c28b39;
  margin-bottom: 3px;
}
.decon-level-slot-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 0.78rem;
  color: #bbb;
}
.decon-level-slot-stats input {
  width: 28px;
  padding: 1px 3px;
  font-size: 0.78rem;
  background: #333;
  border: 1px solid #555;
  border-radius: 3px;
  color: #ddd;
  text-align: center;
}
:global(.decon-stimulant-bound) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 0.82rem;
}
:global(.decon-stimulant-bound) button {
  width: 20px;
  height: 20px;
  font-size: 0.75rem;
  border: 1px solid #555;
  border-radius: 3px;
  background: #2a2a2a;
  color: #ddd;
  cursor: pointer;
}
:global(.decon-stimulant-bound) .decon-stimulant-bound-val {
  min-width: 28px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 3: Run markup test to verify PASS**

```bash
node --test --test-name-pattern "source checkboxes deselected" tests/deconstruction-ui-contract.test.mjs
node --test --test-name-pattern "scroll rate sub-options" tests/deconstruction-ui-contract.test.mjs
```

Expected: PASS for markup existence tests.

- [ ] **Step 4: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: add source pre-filter accordion HTML and CSS"
```

### Task 8: Deconstruction Page — JS Wiring

**Files:**
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Add query selectors for new elements**

Add after the existing level-up source queries (after `deconLevelValue`):

```js
const deconScrollRateSub = document.querySelector('[data-decon-scroll-rate-sub]');
const deconScrollRateInputs = document.querySelectorAll('[data-decon-scroll-rate]');
const deconStimulantBounds = document.querySelector('[data-decon-stimulant-bounds]');
const deconStimulantBoundsList = document.querySelector('[data-decon-stimulant-bounds-list]');
const deconLevelSlotRanges = document.querySelector('[data-decon-level-slot-ranges]');
const deconLevelSlotList = document.querySelector('[data-decon-level-slot-list]');
const deconLevelSlotLabel = document.querySelector('[data-decon-level-slot-label]');
```

- [ ] **Step 2: Add state variables**

Add after `deconHasActionableResults`:

```js
let deconScrollRateFilter = new Set(['100', '60', '10', 'chaos']);
let deconStimulantBoundsMap = {};
let deconLevelUpSlotRanges = [];
```

- [ ] **Step 3: Add accordion toggle on source checkbox change**

Find the existing `deconScrollSource`, `deconStimulantSource`, `deconGemsSource`, `deconItemLevelUpSource` elements (already queried). Add change event listeners that toggle sub-option visibility. Add after the existing source checkbox wiring area:

```js
const toggleSourceSub = (sourceCheckbox, subContainer, onFirstEnable) => {
  if (!(sourceCheckbox instanceof HTMLInputElement) || !(subContainer instanceof HTMLElement)) return;
  const enabled = sourceCheckbox.checked;
  subContainer.hidden = !enabled;
  if (enabled && typeof onFirstEnable === 'function') onFirstEnable();
};

deconScrollSource?.addEventListener('change', () => {
  toggleSourceSub(deconScrollSource, deconScrollRateSub, () => {
    deconScrollRateFilter = new Set(['100', '60', '10', 'chaos']);
    deconScrollRateInputs.forEach(inp => { if (inp instanceof HTMLInputElement) inp.checked = true; });
  });
  renderDeconSourceSubs();
  updateAnalyzeButton();
});

deconStimulantSource?.addEventListener('change', () => {
  toggleSourceSub(deconStimulantSource, deconStimulantBounds, () => {
    buildStimulantBoundsEditor();
  });
  renderDeconSourceSubs();
  updateAnalyzeButton();
});

deconGemsSource?.addEventListener('change', () => {
  renderDeconSourceSubs();
  updateAnalyzeButton();
});

deconItemLevelUpSource?.addEventListener('change', () => {
  toggleSourceSub(deconItemLevelUpSource, deconLevelSlotRanges, () => {
    buildLevelUpSlotEditors();
  });
  renderDeconSourceSubs();
  updateAnalyzeButton();
});
```

- [ ] **Step 4: Add `buildStimulantBoundsEditor` function**

```js
const buildStimulantBoundsEditor = () => {
  if (!(deconStimulantBoundsList instanceof HTMLElement)) return;
  deconStimulantBoundsList.replaceChildren();
  if (!selectedItem) return;
  deconStimulantBoundsMap = {};
  for (const key of deconStatKeys) {
    const isHpMp = HP_MP_KEYS.has(key);
    const defaultLimit = isHpMp ? 50 : 5;
    const stepSize = isHpMp ? 10 : 1;
    deconStimulantBoundsMap[key] = { min: -defaultLimit, max: defaultLimit };
    const row = document.createElement('span');
    row.className = 'decon-stimulant-bound';
    const label = document.createElement('span');
    label.textContent = (statLabelByKey[key] || key) + ': ';
    row.append(label);
    for (const side of ['min', 'max']) {
      const btnDec = document.createElement('button');
      btnDec.type = 'button';
      btnDec.textContent = '−';
      const valSpan = document.createElement('span');
      valSpan.className = 'decon-stimulant-bound-val';
      valSpan.textContent = side === 'min' ? String(-defaultLimit) : String(defaultLimit);
      const btnInc = document.createElement('button');
      btnInc.type = 'button';
      btnInc.textContent = '+';
      btnDec.addEventListener('click', () => {
        const current = deconStimulantBoundsMap[key]?.[side] ?? (side === 'min' ? -defaultLimit : defaultLimit);
        const newVal = Math.max(-defaultLimit, Math.min(defaultLimit, current - stepSize));
        deconStimulantBoundsMap[key] = { ...deconStimulantBoundsMap[key], [side]: newVal };
        valSpan.textContent = String(newVal);
      });
      btnInc.addEventListener('click', () => {
        const current = deconStimulantBoundsMap[key]?.[side] ?? (side === 'min' ? -defaultLimit : defaultLimit);
        const newVal = Math.max(-defaultLimit, Math.min(defaultLimit, current + stepSize));
        deconStimulantBoundsMap[key] = { ...deconStimulantBoundsMap[key], [side]: newVal };
        valSpan.textContent = String(newVal);
      });
      row.append(btnDec, valSpan, btnInc);
    }
    deconStimulantBoundsList.append(row);
  }
};
```

- [ ] **Step 5: Add `buildLevelUpSlotEditors` function**

```js
const buildLevelUpSlotEditors = () => {
  if (!(deconLevelSlotList instanceof HTMLElement) || !(deconLevelSlotLabel instanceof HTMLElement)) return;
  deconLevelSlotList.replaceChildren();
  if (!selectedItem) return;
  const def = itemLevelUpByItemId.get(selectedItem.id);
  const maxLevelUps = Number.isInteger(def?.maxLevelUps) ? def.maxLevelUps : 0;
  if (maxLevelUps <= 0) return;
  const remaining = Math.max(0, maxLevelUps - Math.max(0, Math.min(maxLevelUps, deconItemLevel - 1)));
  deconLevelSlotLabel.textContent = `남은 레벨 (${remaining}개, 총 ${maxLevelUps}회):`;
  const statRanges = def?.statRanges ?? {};
  // Initialize or preserve persistent slot array up to maxLevelUps
  if (deconLevelUpSlotRanges.length !== maxLevelUps) {
    const newRanges = [];
    for (let i = 0; i < maxLevelUps; i++) {
      newRanges.push(deconLevelUpSlotRanges[i] ?? buildDefaultSlotRanges(statRanges));
    }
    deconLevelUpSlotRanges = newRanges;
  }
  // Render only remaining slots
  for (let i = 0; i < remaining; i++) {
    const slot = document.createElement('div');
    slot.className = 'decon-level-slot';
    const header = document.createElement('div');
    header.className = 'decon-level-slot-label';
    header.textContent = `슬롯 ${i + 1}`;
    slot.append(header);
    const statsRow = document.createElement('div');
    statsRow.className = 'decon-level-slot-stats';
    const slotRanges = deconLevelUpSlotRanges[i];
    for (const key of Object.keys(statRanges)) {
      const defRange = statRanges[key] ?? { min: 0, max: 0 };
      const current = slotRanges?.[key] ?? { ...defRange };
      if (!slotRanges[key]) slotRanges[key] = { ...defRange };
      const statEl = document.createElement('span');
      statEl.textContent = (statLabelByKey[key] || key) + ' ';
      const minInput = document.createElement('input');
      minInput.type = 'number';
      minInput.min = defRange.min;
      minInput.max = defRange.max;
      minInput.value = current.min;
      minInput.addEventListener('change', () => {
        const val = Number(minInput.value);
        if (Number.isFinite(val)) {
          slotRanges[key] = { ...slotRanges[key], min: Math.max(defRange.min, Math.min(defRange.max, val)) };
          minInput.value = slotRanges[key].min;
        }
      });
      const maxInput = document.createElement('input');
      maxInput.type = 'number';
      maxInput.min = defRange.min;
      maxInput.max = defRange.max;
      maxInput.value = current.max;
      maxInput.addEventListener('change', () => {
        const val = Number(maxInput.value);
        if (Number.isFinite(val)) {
          slotRanges[key] = { ...slotRanges[key], max: Math.max(defRange.min, Math.min(defRange.max, val)) };
          maxInput.value = slotRanges[key].max;
        }
      });
      statEl.append(minInput, document.createTextNode(' ~ '), maxInput, ' ');
      statsRow.append(statEl);
    }
    slot.append(statsRow);
    deconLevelSlotList.append(slot);
  }
};

const buildDefaultSlotRanges = (statRanges) => {
  const defaults = {};
  for (const [key, range] of Object.entries(statRanges)) {
    defaults[key] = { min: range.min, max: range.max };
  }
  return defaults;
};
```

- [ ] **Step 6: Add `renderDeconSourceSubs` and call from render functions**

```js
const renderDeconSourceSubs = () => {
  if (deconScrollRateSub instanceof HTMLElement) {
    deconScrollRateSub.hidden = !(deconScrollSource instanceof HTMLInputElement && deconScrollSource.checked);
  }
  if (deconStimulantBounds instanceof HTMLElement) {
    deconStimulantBounds.hidden = !(deconStimulantSource instanceof HTMLInputElement && deconStimulantSource.checked);
  }
  if (deconLevelSlotRanges instanceof HTMLElement) {
    const levelUpSourceEnabled = deconItemLevelUpSource instanceof HTMLInputElement && deconItemLevelUpSource.checked;
    deconLevelSlotRanges.hidden = !levelUpSourceEnabled;
  }
};
```

- [ ] **Step 7: Add rate chip toggle handler**

```js
deconScrollRateInputs.forEach((chip) => {
  chip.addEventListener('change', () => {
    if (!(chip instanceof HTMLInputElement)) return;
    const rate = chip.dataset.deconScrollRate;
    if (chip.checked) {
      deconScrollRateFilter.add(rate);
    } else {
      deconScrollRateFilter.delete(rate);
    }
  });
});
```

- [ ] **Step 8: Pass pre-filters in `runAnalysis`**

In `runAnalysis`, replace the `enumerateStrategies` call to include pre-filter params. Find the existing call and add three new lines after `levelUpDefinition: levelUpDef ?? null,`:

```js
    scrollRateFilter: deconScrollRateFilter.size > 0 ? deconScrollRateFilter : null,
    stimulantStatBounds: Object.keys(deconStimulantBoundsMap).length > 0 ? deconStimulantBoundsMap : null,
    levelUpSlotStatRanges: deconLevelUpSlotRanges.length > 0 ? deconLevelUpSlotRanges : null,
```

- [ ] **Step 9: Reset pre-filter state on item selection**

In `selectSuggestedItem` (after the other resets), add:

```js
  deconScrollRateFilter = new Set(['100', '60', '10', 'chaos']);
  deconStimulantBoundsMap = {};
  deconLevelUpSlotRanges = [];
  deconScrollRateInputs.forEach(inp => { if (inp instanceof HTMLInputElement) inp.checked = true; });
```

In `activateDeconEditPanel` (after the other resets), add:

```js
  deconScrollRateFilter = new Set(['100', '60', '10', 'chaos']);
  deconStimulantBoundsMap = {};
  deconLevelUpSlotRanges = [];
  deconScrollRateInputs.forEach(inp => { if (inp instanceof HTMLInputElement) inp.checked = true; });
```

- [ ] **Step 10: Rebuild level-up slots when 아이템 레벨 stepper changes**

In `renderDeconItemLevel` (after `updateTargetCard();`), add:

```js
  if (deconItemLevelUpSource instanceof HTMLInputElement && deconItemLevelUpSource.checked) {
    buildLevelUpSlotEditors();
  }
```

- [ ] **Step 11: Run all UI contract tests to verify GREEN**

```bash
node --test --test-name-pattern "source checkboxes|scroll rate|stimulant stat|level-up slot|getDefaultSourceSelection|pre-filter params" tests/deconstruction-ui-contract.test.mjs
```

Expected: all new tests PASS.

- [ ] **Step 12: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: wire source pre-filter accordion JS logic"
```

### Task 9: Regression and Build Verification

**Files:**
- Verify all changed files

- [ ] **Step 1: Run all deconstruction tests**

```bash
node --test tests/deconstruction-*.test.mjs
```

Expected: all tests PASS with no failures.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: Astro completes the production build successfully with exit code `0`.

- [ ] **Step 3: Inspect the final scoped diff**

```bash
git diff main..HEAD -- src/ tests/
git status --short
```

Expected: only the six approved files appear.

## Self-Review

- Spec requirements: accordion UI ✓, scroll rate chips ✓, stimulant bounds steppers ✓, level-up slot ranges ✓, all sources deselected default ✓, engine scrollRateFilter ✓, engine stimulantStatBounds ✓, engine levelUpSlotStatRanges ✓, level-up slot persistence ✓, result filters unchanged ✓
- Engine tests: scrollRateFilter (3 tests) ✓, stimulantStatBounds (2 tests) ✓, levelUpSlotStatRanges (2 tests) ✓
- UI contract tests: deselected defaults ✓, scroll rate markup ✓, stimulant bounds markup ✓, level-up slot markup ✓, getDefaultSourceSelection ✓, runAnalysis passthrough ✓
- No TBDs, TODOs, or placeholder code
- Function/variable names consistent across tasks
