# Item Level Stepper Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an item level stepper for Reverse/Timeless items on the deconstruction page so users can specify how many level-ups remain.

**Architecture:** Add an HTML stepper row under the slot row, a `deconItemLevel` state variable, pass already-applied-levels through the engine to `enumerateItemLevelContributions` as a new `alreadyAppliedLevels` parameter, and render ITEM LEV/EXP card rows from virtual filled slots. The CSS fix for `selected-item-line--item-level` is bundled since it touches the same card display code.

**Tech Stack:** Astro page script, browser DOM APIs, Node.js built-in test runner.

---

## File Structure

- Modify `src/lib/deconstruction/sourceContributions.mjs` — add `alreadyAppliedLevels` parameter to `enumerateItemLevelContributions`
- Modify `src/lib/deconstruction/engine.mjs` — add `alreadyAppliedLevels` to `enumerateStrategies` and pass through
- Modify `src/pages/deconstruction.astro` — HTML stepper row, CSS, JS state/wiring/events, card display virtual slots, engine passthrough
- Modify `tests/deconstruction-engine.test.mjs` — unit tests for `alreadyAppliedLevels` parameter
- Modify `tests/deconstruction-ui-contract.test.mjs` — contract tests for level stepper visibility, controls, and engine passthrough

### Task 1: Engine Unit Tests for alreadyAppliedLevels

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`

- [ ] **Step 1: Add the import and write the three new tests**

Add this import after the existing `enumerateStrategies` import:

```js
import { enumerateItemLevelContributions } from '../src/lib/deconstruction/sourceContributions.mjs';
```

Add these three tests after the existing item-level contribution tests (after the `stimulant item-level` block, around line 500):

```js
test('enumerateItemLevelContributions alreadyAppliedLevels=0 matches full range (regression)', () => {
  const levelUpDef = { maxLevelUps: 2, statRanges: { str: { min: 1, max: 1 } } };
  const base = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
  });
  const withZero = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
    alreadyAppliedLevels: 0,
  });
  assert.equal(base.length, withZero.length);
  for (let i = 0; i < base.length; i++) {
    assert.equal(base[i].levelCount, withZero[i].levelCount);
    assert.deepEqual(base[i].stats, withZero[i].stats);
  }
});

test('enumerateItemLevelContributions respects alreadyAppliedLevels', () => {
  const levelUpDef = { maxLevelUps: 5, statRanges: { str: { min: 1, max: 1 }, dex: { min: 0, max: 1 } } };
  const contributions = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str', 'dex'],
    bounds: { str: { min: -Infinity, max: Infinity }, dex: { min: -Infinity, max: Infinity } },
    alreadyAppliedLevels: 3,
  });
  assert.ok(contributions.length > 0, 'should have contributions for remaining 2 levels');
  for (const c of contributions) {
    assert.ok(c.levelCount <= 2, `levelCount ${c.levelCount} should not exceed remaining levels (2)`);
    assert.ok(c.levelCount >= 1, `levelCount ${c.levelCount} should be at least 1`);
  }
});

test('enumerateItemLevelContributions returns empty when alreadyAppliedLevels equals maxLevelUps', () => {
  const levelUpDef = { maxLevelUps: 5, statRanges: { str: { min: 1, max: 1 } } };
  const contributions = enumerateItemLevelContributions({
    levelUpDefinition: levelUpDef,
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
    alreadyAppliedLevels: 5,
  });
  assert.equal(contributions.length, 0);
});
```

- [ ] **Step 2: Run the focused tests to verify RED**

```bash
node --test --test-name-pattern "alreadyAppliedLevels" tests/deconstruction-engine.test.mjs
```

Expected: FAIL because `alreadyAppliedLevels` is not yet a recognized parameter.

- [ ] **Step 3: Commit the failing tests**

```bash
git add tests/deconstruction-engine.test.mjs
git commit -m "test: cover enumerateItemLevelContributions alreadyAppliedLevels"
```

### Task 2: Engine alreadyAppliedLevels Implementation

**Files:**
- Modify: `src/lib/deconstruction/sourceContributions.mjs:58-80`
- Modify: `src/lib/deconstruction/engine.mjs:289-302,360-366`

- [ ] **Step 1: Add `alreadyAppliedLevels` to `enumerateItemLevelContributions`**

Replace the function signature and body in `sourceContributions.mjs`:

```js
export function enumerateItemLevelContributions({ levelUpDefinition, targetKeys, bounds, alreadyAppliedLevels = 0 }) {
  const maxLevelUps = levelUpDefinition?.maxLevelUps;
  if (!Number.isInteger(maxLevelUps) || maxLevelUps <= 0) return [];

  const remainingLevels = maxLevelUps - (Number.isFinite(alreadyAppliedLevels) ? Math.max(0, Math.trunc(alreadyAppliedLevels)) : 0);
  if (remainingLevels <= 0) return [];

  const oneLevel = enumerateRangeVectors(levelUpDefinition.statRanges ?? {}, targetKeys);
  let previous = [{ stats: Object.fromEntries(targetKeys.map((key) => [key, 0])) }];

  for (let levelCount = 1; levelCount <= remainingLevels; levelCount++) {
    const seen = new Map();
    for (const base of previous) {
      for (const outcome of oneLevel) {
        const stats = addVectors(base.stats, outcome, targetKeys);
        if (levelCount === remainingLevels && !withinBounds(stats, bounds, targetKeys)) continue;
        seen.set(vectorKey(stats, targetKeys), { levelCount, stats });
      }
    }
    previous = [...seen.values()].sort((left, right) =>
      vectorKey(left.stats, targetKeys).localeCompare(vectorKey(right.stats, targetKeys)),
    );
  }

  return previous;
}
```

- [ ] **Step 2: Add `alreadyAppliedLevels` to `enumerateStrategies` and pass through**

Add the parameter to the destructured options (around line 293-303):

Replace:
```js
export function enumerateStrategies({
  targetDeltas,
  targetKeys = Object.keys(targetDeltas),
  successfulScrollCount,
  equipmentKind,
  requiredLevel = 0,
  cleanStats = {},
  scrollsByEquipmentKind,
  levelUpDefinition = null,
  allowedSources,
}) {
```

With:
```js
export function enumerateStrategies({
  targetDeltas,
  targetKeys = Object.keys(targetDeltas),
  successfulScrollCount,
  equipmentKind,
  requiredLevel = 0,
  cleanStats = {},
  scrollsByEquipmentKind,
  levelUpDefinition = null,
  allowedSources,
  alreadyAppliedLevels = 0,
}) {
```

Add `alreadyAppliedLevels` to the `enumerateItemLevelContributions` call (around line 360-366):

Replace:
```js
  const itemLevelContributions = normalizedAllowedSources.itemLevelUp
    ? enumerateItemLevelContributions({
        levelUpDefinition,
        targetKeys,
        bounds: itemBounds,
      })
    : [];
```

With:
```js
  const itemLevelContributions = normalizedAllowedSources.itemLevelUp
    ? enumerateItemLevelContributions({
        levelUpDefinition,
        targetKeys,
        bounds: itemBounds,
        alreadyAppliedLevels,
      })
    : [];
```

Update the JSDoc above the function to document `alreadyAppliedLevels`:

Add after the `levelUpDefinition` doc line (around line 289-291):
```js
 * @param {number}             opts.alreadyAppliedLevels  Level-ups already consumed (default 0)
```

- [ ] **Step 3: Run engine tests to verify GREEN**

```bash
node --test --test-name-pattern "alreadyAppliedLevels" tests/deconstruction-engine.test.mjs
```

Expected: all three new tests PASS.

- [ ] **Step 4: Run all engine tests to verify no regressions**

```bash
node --test tests/deconstruction-engine.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/deconstruction/sourceContributions.mjs src/lib/deconstruction/engine.mjs
git commit -m "fix: limit item-level contributions to remaining levels"
```

### Task 3: UI Contract Tests for Level Stepper

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Write the contract tests**

Add these tests after the existing `target card refresh ignores stale in-memory selection` test (after line ~86, before the `analysis passes the exact successful-scroll count` test):

```js
test('item level stepper markup exists and is hidden by default', () => {
  assert.match(pageSource, /data-decon-level-row[^>]*hidden/);
  assert.match(pageSource, /data-decon-level-value/);
  assert.match(pageSource, /data-decon-level-min/);
  assert.match(pageSource, /data-decon-level-inc/);
  assert.match(pageSource, /data-decon-level-dec/);
  assert.match(pageSource, /data-decon-level-max/);
});

test('item level stepper respects level-up definition visibility and engine passthrough', () => {
  const toggleStart = pageSource.indexOf('const updateLevelUpSourceEligibility = () => {');
  const toggleEnd = pageSource.indexOf('\n}', toggleStart);
  const toggleSource = pageSource.slice(toggleStart, toggleEnd);
  assert.match(
    toggleSource,
    /deconLevelUpSource\.hidden = !selectedItem \|\| !itemLevelUpByItemId\.has\(selectedItem\.id\)\s*\|\|\s*deconItemLevel\s*>=/,
  );

  assert.match(
    pageSource,
    /data-decon-level-row\.hidden = !selectedItem\b/,
  );

  const runAnalysisStart = pageSource.indexOf('const runAnalysis = () => {');
  const displayResultsStart = pageSource.indexOf('const displayResults = (', runAnalysisStart);
  assert.ok(runAnalysisStart >= 0 && displayResultsStart > runAnalysisStart);
  const runAnalysisSource = pageSource.slice(runAnalysisStart, displayResultsStart);
  assert.match(
    runAnalysisSource,
    /alreadyAppliedLevels:\s*deconItemLevel\s*-?\s*1/,
  );
});

test('item level card display uses virtual slots from deconItemLevel', () => {
  const renderTargetItemCardStart = pageSource.indexOf('const renderTargetItemCard = (item) => {');
  const updateTargetCardStart = pageSource.indexOf('\nconst updateTargetCard = () => {', renderTargetItemCardStart);
  const renderSource = pageSource.slice(renderTargetItemCardStart, updateTargetCardStart);
  assert.match(
    renderSource,
    /const alreadyApplied = (?:deconItemLevel\s*-\s*1|\(deconItemLevel\b[^)]*\)\s*-\s*1)/,
  );
  assert.match(
    renderSource,
    /Array\(maxLevelUps\)\.fill\(null\)\.map\(\(_\,\s*i\)\s*=>\s*i\s*<\s*alreadyApplied/,
  );
});
```

- [ ] **Step 2: Run the focused tests to verify RED**

```bash
node --test --test-name-pattern "item level stepper" tests/deconstruction-ui-contract.test.mjs
```

Expected: FAIL because the stepper markup and JS wiring are not yet implemented.

- [ ] **Step 3: Commit**

```bash
git add tests/deconstruction-ui-contract.test.mjs
git commit -m "test: cover item level stepper UI contract"
```

### Task 4: Deconstruction Page — HTML and CSS

**Files:**
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Add the level stepper HTML row**

Insert after line 213 (`</div>` closing `.decon-slot-row`), before line 214 (`<div class="decon-add-stat-area">`):

```html
            <div class="chaos-stat-row decon-level-row" data-decon-level-row hidden>
              <span class="chaos-stat-label">아이템 레벨</span>
              <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-level-min>MIN</button>
              <button type="button" class="chaos-stepper-btn" data-decon-level-dec>−</button>
              <span class="chaos-stepper-value" data-decon-level-value>1</span>
              <button type="button" class="chaos-stepper-btn" data-decon-level-inc>+</button>
              <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-level-max>MAX</button>
            </div>
```

- [ ] **Step 2: Add CSS rules**

Add the `.decon-level-row` rule after the existing `.decon-slot-row` rule (after line 2393):

```css
.decon-level-row {
  margin-bottom: 10px;
}
```

Add the `:global(.selected-item-line--item-level)` rule after the existing `:global(.selected-item-line--requirement)` rule (after line 2081):

```css
:global(.selected-item-line--item-level) {
  min-height: 16px;
  line-height: 16px;
  color: #c28b39;
}
```

- [ ] **Step 3: Run the UI contract test to verify still RED**

```bash
node --test --test-name-pattern "item level stepper markup" tests/deconstruction-ui-contract.test.mjs
```

Expected: PASS (markup exists now).

```bash
node --test --test-name-pattern "item level stepper respects" tests/deconstruction-ui-contract.test.mjs
```

Expected: FAIL (JS wiring not done yet).

- [ ] **Step 4: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: add item level stepper HTML and CSS"
```

### Task 5: Deconstruction Page — JS Wiring

**Files:**
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Add data attribute queries and state variable**

Add query selectors after the existing `deconLevelUpSource` line (after line 384):

```js
const deconLevelRow = document.querySelector('[data-decon-level-row]');
const deconLevelMinBtn = document.querySelector('[data-decon-level-min]');
const deconLevelDecBtn = document.querySelector('[data-decon-level-dec]');
const deconLevelIncBtn = document.querySelector('[data-decon-level-inc]');
const deconLevelMaxBtn = document.querySelector('[data-decon-level-max]');
const deconLevelValue = document.querySelector('[data-decon-level-value]');
```

Add state variable after `deconHasActionableResults` (after line 401):

```js
let deconItemLevel = 1;
```

- [ ] **Step 2: Add `getDeconItemLevelSourceEligibility` helper and update `updateLevelUpSourceEligibility`**

Replace the existing `updateLevelUpSourceEligibility` function (lines 446-449):

```js
const getDeconItemLevelSourceEligibility = () => {
  if (!selectedItem) return false;
  const def = itemLevelUpByItemId.get(selectedItem.id);
  if (!def) return false;
  const maxLevelUps = Number.isInteger(def.maxLevelUps) ? def.maxLevelUps : 0;
  return deconItemLevel < maxLevelUps;
};

const updateLevelUpSourceEligibility = () => {
  if (!(deconLevelUpSource instanceof HTMLElement)) return;
  deconLevelUpSource.hidden = !selectedItem || !itemLevelUpByItemId.has(selectedItem.id) || !getDeconItemLevelSourceEligibility();
  updateAnalyzeButton();
};
```

- [ ] **Step 3: Add `renderDeconItemLevel` function and call it from item selection**

Add this function after `renderDeconSlotState` (after line 913):

```js
const renderDeconItemLevel = () => {
  if (!(deconLevelRow instanceof HTMLElement)) return;
  const def = selectedItem ? itemLevelUpByItemId.get(selectedItem.id) : null;
  const maxLevelUps = Number.isInteger(def?.maxLevelUps) ? def.maxLevelUps : 0;
  deconLevelRow.hidden = !selectedItem || maxLevelUps <= 0;
  if (maxLevelUps > 0 && deconLevelMaxBtn instanceof HTMLButtonElement) {
    deconLevelMaxBtn.textContent = `MAX ${maxLevelUps}`;
  }
  if (deconLevelValue instanceof HTMLElement) {
    deconLevelValue.textContent = String(deconItemLevel);
  }
  updateTargetCard();
};
```

In `selectSuggestedItem` (around line 990), add after `updateLevelUpSourceEligibility();`:

```js
  deconItemLevel = 1;
  renderDeconItemLevel();
```

In `activateDeconEditPanel` (around line 1214-1215), add after `deconSlotState = createDeconstructionSlotState(...)`:

```js
  deconItemLevel = 1;
```
And add after the `renderDeconSlotState();` line:
```js
  renderDeconItemLevel();
```

- [ ] **Step 4: Update `renderTargetItemCard` to use virtual slots**

Replace the `computeItemLevelUpCardMeta` call in `renderTargetItemCard` (lines 654-657):

Replace:
```js
  const itemLevelUpMeta = computeItemLevelUpCardMeta(
    { itemLevelUpSlots: [] },
    itemLevelUpByItemId.get(item.id) ?? null,
  );
```

With:
```js
  const levelUpDef = itemLevelUpByItemId.get(item.id);
  const maxLevelUps = Number.isInteger(levelUpDef?.maxLevelUps) ? levelUpDef.maxLevelUps : 0;
  const alreadyApplied = Math.max(0, Math.min(maxLevelUps, deconItemLevel - 1));
  const virtualSlots = Array(maxLevelUps).fill(null).map((_, i) => i < alreadyApplied ? { stats: {} } : null);
  const itemLevelUpMeta = computeItemLevelUpCardMeta(
    { itemLevelUpSlots: virtualSlots },
    levelUpDef ?? null,
  );
```

- [ ] **Step 5: Wire stepper button events**

Add after the existing slot button event listeners (after line 1621, before the reset handlers):

```js
deconLevelMinBtn?.addEventListener('click', () => guardDeconMutation(() => {
  deconItemLevel = 1;
  renderDeconItemLevel();
  updateLevelUpSourceEligibility();
}));
deconLevelDecBtn?.addEventListener('click', () => guardDeconMutation(() => {
  if (deconItemLevel > 1) {
    deconItemLevel--;
    renderDeconItemLevel();
    updateLevelUpSourceEligibility();
  }
}));
deconLevelIncBtn?.addEventListener('click', () => guardDeconMutation(() => {
  const def = selectedItem ? itemLevelUpByItemId.get(selectedItem.id) : null;
  const maxLevelUps = Number.isInteger(def?.maxLevelUps) ? def.maxLevelUps : 0;
  if (deconItemLevel < maxLevelUps) {
    deconItemLevel++;
    renderDeconItemLevel();
    updateLevelUpSourceEligibility();
  }
}));
deconLevelMaxBtn?.addEventListener('click', () => guardDeconMutation(() => {
  const def = selectedItem ? itemLevelUpByItemId.get(selectedItem.id) : null;
  const maxLevelUps = Number.isInteger(def?.maxLevelUps) ? def.maxLevelUps : 0;
  deconItemLevel = Math.max(1, maxLevelUps);
  renderDeconItemLevel();
  updateLevelUpSourceEligibility();
}));
```

- [ ] **Step 6: Pass `alreadyAppliedLevels` to `enumerateStrategies` in `runAnalysis`**

In `runAnalysis` (around line 1245-1256), add `alreadyAppliedLevels` to the `enumerateStrategies` call. Replace:

```js
  const result = enumerateStrategies({
    targetDeltas,
    targetKeys: checkedKeys,
    successfulScrollCount: deconSlotState.successfulScrollCount,
    equipmentKind,
    allowedSources: getAllowedSources(),
    requiredLevel: selectedItem.requiredLevel ?? 0,
    cleanStats: selectedItem.stats ?? {},
    scrollsByEquipmentKind,
    levelUpDefinition: itemLevelUpByItemId.get(selectedItem.id) ?? null,
  });
```

With:

```js
  const levelUpDef = itemLevelUpByItemId.get(selectedItem.id);
  const result = enumerateStrategies({
    targetDeltas,
    targetKeys: checkedKeys,
    successfulScrollCount: deconSlotState.successfulScrollCount,
    equipmentKind,
    allowedSources: getAllowedSources(),
    requiredLevel: selectedItem.requiredLevel ?? 0,
    cleanStats: selectedItem.stats ?? {},
    scrollsByEquipmentKind,
    levelUpDefinition: levelUpDef ?? null,
    alreadyAppliedLevels: levelUpDef ? Math.max(0, deconItemLevel - 1) : 0,
  });
```

- [ ] **Step 7: Update `getAllowedSources` for item-level source eligibility with max level check**

In `getAllowedSources` (around lines 423-434), update the `itemLevelUpEligible` check. Replace:

```js
  {
    itemLevelUpEligible:
      deconLevelUpSource instanceof HTMLElement && !deconLevelUpSource.hidden,
  },
```

With:

```js
  {
    itemLevelUpEligible:
      deconLevelUpSource instanceof HTMLElement && !deconLevelUpSource.hidden && getDeconItemLevelSourceEligibility(),
  },
```

- [ ] **Step 8: Run the UI contract tests to verify GREEN**

```bash
node --test --test-name-pattern "item level stepper" tests/deconstruction-ui-contract.test.mjs
```

Expected: all three new tests PASS.

- [ ] **Step 9: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: wire item level stepper to card display and engine"
```

### Task 6: Regression and Build Verification

**Files:**
- Verify: `src/lib/deconstruction/sourceContributions.mjs`
- Verify: `src/lib/deconstruction/engine.mjs`
- Verify: `src/pages/deconstruction.astro`
- Verify: `tests/deconstruction-ui-contract.test.mjs`
- Verify: `tests/deconstruction-engine.test.mjs`

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

Expected: only the five approved files appear.

## Self-Review

- Spec requirements: stepper HTML ✓, CSS ✓, state variable ✓, show/hide logic ✓, virtual slots for card ✓, engine `alreadyAppliedLevels` ✓, source eligibility at max ✓, guarded mutation ✓
- Engine tests: alreadyAppliedLevels=0 regression ✓, alreadyAppliedLevels=3 → 2 levels ✓, alreadyAppliedLevels=5 → empty ✓
- UI contract tests: markup exists hidden ✓, visibility/eligibility/passthrough ✓, virtual slots ✓
- CSS fix: `:global(.selected-item-line--item-level) { color: #c28b39 }` bundled in Task 4 Step 2 ✓
- No TBDs, TODOs, or placeholder code
- Function/variable names are consistent across tasks: `deconItemLevel`, `alreadyAppliedLevels`, `renderDeconItemLevel`, `getDeconItemLevelSourceEligibility`
