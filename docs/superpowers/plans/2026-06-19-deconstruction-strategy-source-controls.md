# Deconstruction Strategy Source Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add source-permission controls to the deconstruction calculator so exact-match strategy enumeration uses only allowed enhancement types and refuses to display result sets larger than 1,000.

**Architecture:** Keep source permission state in the Step 3 controls and pass a normalized `allowedSources` object into the existing exact-match engine. The engine conditionally generates contributions and visits only allowed combination tiers, using an empty scroll state for zero-success non-scroll strategies. Replace the old 500-result truncation with a 1,001st-result overflow sentinel that the page renders as guidance instead of cards.

**Tech Stack:** Astro 6, browser DOM APIs, ECMAScript modules, Node.js `node:test`

---

## File structure

- Modify `src/lib/deconstruction/engine.mjs`: normalize source permissions, gate contribution generation and strategy tiers, support zero-scroll bases, and return the 1,000-result overflow contract.
- Modify `tests/deconstruction-engine.test.mjs`: specify permission filtering, non-scroll strategies, defensive conflicts, compatibility defaults, and the overflow boundary.
- Modify `src/pages/deconstruction.astro`: render and manage source controls, validate them, pass permissions to the engine, and render overflow guidance.
- Modify `tests/deconstruction-ui-contract.test.mjs`: specify markup hooks, state lifecycle, validation wiring, engine input, and overflow rendering.

### Task 1: Engine source permissions and zero-scroll strategies

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`
- Modify: `src/lib/deconstruction/engine.mjs:1-520`

- [ ] **Step 1: Write failing engine permission tests**

Append focused tests using a fixture that makes each fallback source observable:

```js
function makeAllowedSourceFixture(overrides = {}) {
  return {
    targetDeltas: { str: 3 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: 'Cape',
    requiredLevel: 50,
    cleanStats: { str: 5 },
    scrollsByEquipmentKind: new Map([['Cape', [
      {
        id: 9101,
        nameKo: '힘 주문서 +1',
        behavior_type: 'fixed',
        stats: { str: 1 },
      },
      {
        id: 9102,
        nameKo: '힘 주문서 +3',
        behavior_type: 'fixed',
        stats: { str: 3 },
      },
    ]]]),
    levelUpDefinition: {
      maxLevelUps: 1,
      statRanges: { str: { min: 1, max: 1 } },
    },
    ...overrides,
  };
}

test('allowed sources are permitted but not required', () => {
  const result = enumerateStrategies(makeAllowedSourceFixture({
    allowedSources: {
      scrolls: true,
      stimulant: true,
      gems: false,
      itemLevelUp: false,
    },
  }));

  assert.ok(result.strategies.some((strategy) =>
    strategy.sourceTypes.length === 1 && strategy.sourceTypes[0] === 'scrolls'));
  assert.ok(result.strategies.some((strategy) =>
    strategy.sourceTypes.includes('scrolls') && strategy.sourceTypes.includes('stimulant')));
  assert.ok(result.strategies.every((strategy) => strategy.gems.length === 0));
  assert.ok(result.strategies.every((strategy) => !strategy.hasItemLevelUp));
});

test('each disabled source is absent from returned strategies', () => {
  const sourceCases = [
    ['stimulant', (strategy) => strategy.hasStimulant],
    ['gems', (strategy) => strategy.gems.length > 0],
    ['itemLevelUp', (strategy) => strategy.hasItemLevelUp],
  ];

  for (const [disabledSource, usesSource] of sourceCases) {
    const allowedSources = {
      scrolls: true,
      stimulant: true,
      gems: true,
      itemLevelUp: true,
      [disabledSource]: false,
    };
    const result = enumerateStrategies(makeAllowedSourceFixture({ allowedSources }));
    assert.ok(result.strategies.every((strategy) => !usesSource(strategy)));
  }
});

test('zero successful scrolls permit enabled non-scroll strategies', () => {
  const result = enumerateStrategies(makeAllowedSourceFixture({
    targetDeltas: { str: 1 },
    successfulScrollCount: 0,
    allowedSources: {
      scrolls: false,
      stimulant: true,
      gems: false,
      itemLevelUp: false,
    },
  }));

  assert.ok(result.strategies.length > 0);
  assert.ok(result.strategies.every((strategy) => strategy.scrolls.length === 0));
  assert.ok(result.strategies.every((strategy) => strategy.hasStimulant));
});

test('zero successful scrolls permit mixed non-scroll strategies', () => {
  const result = enumerateStrategies(makeAllowedSourceFixture({
    targetDeltas: { str: 2 },
    successfulScrollCount: 0,
    allowedSources: {
      scrolls: false,
      stimulant: true,
      gems: false,
      itemLevelUp: true,
    },
  }));

  assert.ok(result.strategies.some((strategy) =>
    strategy.sourceTypes.length === 2
      && strategy.sourceTypes.includes('stimulant')
      && strategy.sourceTypes.includes('itemLevelUp')));
});

test('positive successful scroll count conflicts with disabled scrolls', () => {
  const result = enumerateStrategies(makeAllowedSourceFixture({
    allowedSources: {
      scrolls: false,
      stimulant: true,
      gems: true,
      itemLevelUp: true,
    },
  }));

  assert.deepEqual(result.strategies, []);
  assert.equal(result.total, 0);
  assert.equal(result.tooManyResults, false);
});

test('omitted allowedSources preserves all-source behavior', () => {
  const result = enumerateStrategies(makeAllowedSourceFixture());
  assert.ok(result.strategies.some((strategy) => strategy.hasStimulant));
  assert.ok(result.strategies.some((strategy) => strategy.gems.length > 0));
  assert.ok(result.strategies.some((strategy) => strategy.hasItemLevelUp));
});
```

- [ ] **Step 2: Run the engine tests and verify the new tests fail**

Run: `node --test tests/deconstruction-engine.test.mjs`

Expected: FAIL because `allowedSources` is ignored, zero-scroll non-scroll strategies are absent, and `tooManyResults` is not returned.

- [ ] **Step 3: Normalize permissions and add defensive early returns**

In `enumerateStrategies`, add the option and normalize missing keys to the compatibility default:

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
  const allowed = {
    scrolls: allowedSources?.scrolls ?? true,
    stimulant: allowedSources?.stimulant ?? true,
    gems: allowedSources?.gems ?? true,
    itemLevelUp: allowedSources?.itemLevelUp ?? true,
  };
```

After normalizing `successfulScrollCount`, return the normal empty-result shape for the contradictory scroll state:

```js
  if (!allowed.scrolls && normCount > 0) {
    return {
      strategies: [],
      total: 0,
      tooManyResults: false,
    };
  }
```

Update every other empty return in the function to use the same `tooManyResults: false` result shape.

- [ ] **Step 4: Gate contribution generation and create the zero-scroll base**

Replace unconditional fallback generation with:

```js
  const gemContributions = allowed.gems
    ? enumerateGemContributions({
        gemSlotCount,
        equipmentKind,
        cleanStats,
        targetKeys,
        bounds: gemBounds,
      })
    : [];

  const itemLevelContributions = allowed.itemLevelUp
    ? enumerateItemLevelContributions({
        levelUpDefinition,
        targetKeys,
        bounds: itemBounds,
      })
    : [];

  const scrollStates = allowed.scrolls && normCount > 0
    ? enumerateExactCountScrollStates({
        scrolls,
        targetKeys,
        targetDeltas,
        successfulScrollCount: normCount,
        correctionBounds: stimulantBounds,
      })
    : [];

  const effectiveScrollStates = scrollStates.length > 0
    ? scrollStates
    : (normCount === 0
        ? [{
            scrolls: [],
            stats: Object.fromEntries(targetKeys.map((key) => [key, 0])),
          }]
        : []);
```

Remove the obsolete `targetAllZero` fallback condition. The empty state is a search base; `addResult` still enforces exact matching.

- [ ] **Step 5: Guard all eight strategy tiers**

Change only the condition on each existing tier block, leaving its body and priority rank intact:

```js
  if (allowed.scrolls && isExactVector(ss.stats, targetVector, targetKeys)) {
    addResult({
      scrolls: ss.scrolls,
      stimulant: null,
      gems: [],
      itemLevelUp: null,
      priorityRank: 0,
    });
  }

  // Tier 1 condition
  if (allowed.stimulant && strategies.length < MAX_STRATEGIES) {

  // Tier 2 condition
  if (allowed.gems && strategies.length < MAX_STRATEGIES) {

  // Tier 3 condition
  if (allowed.itemLevelUp && strategies.length < MAX_STRATEGIES) {

  // Tier 4 condition
  if (allowed.stimulant && allowed.gems && strategies.length < MAX_STRATEGIES) {

  // Tier 5 condition
  if (allowed.stimulant && allowed.itemLevelUp && strategies.length < MAX_STRATEGIES) {

  // Tier 6 condition
  if (allowed.gems && allowed.itemLevelUp && strategies.length < MAX_STRATEGIES) {

  // Tier 7 condition
  if (allowed.stimulant && allowed.gems && allowed.itemLevelUp
      && strategies.length < MAX_STRATEGIES) {
```

`ss.scrolls` is empty when the success count is zero, so these same tier bodies produce stimulant-only, gem-only, level-up-only, and mixed non-scroll results without a second solver.

- [ ] **Step 6: Run the focused engine tests**

Run: `node --test tests/deconstruction-engine.test.mjs`

Expected: the new permission tests PASS; existing cap tests may still need Task 2 updates.

- [ ] **Step 7: Commit the source-permission engine change**

```bash
git add src/lib/deconstruction/engine.mjs tests/deconstruction-engine.test.mjs
git commit -m "feat: filter deconstruction strategy sources"
```

### Task 2: Replace truncation with the 1,000-result overflow contract

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`
- Modify: `src/lib/deconstruction/engine.mjs:10-175,270-520`

- [ ] **Step 1: Replace old cap tests with exact boundary tests**

Replace both tests that assert a 500-result cap with:

```js
function makeLargeFixture(count) {
  const scrolls = Array.from({ length: count }, (_, index) => ({
    id: 8000 + index,
    nameKo: `힘 주문서 ${index}`,
    behavior_type: 'fixed',
    stats: { str: 1 },
  }));
  return {
    targetDeltas: { str: 1 },
    targetKeys: ['str'],
    successfulScrollCount: 1,
    equipmentKind: '망토',
    requiredLevel: 0,
    cleanStats: { str: 1 },
    scrollsByEquipmentKind: new Map([['망토', scrolls]]),
    levelUpDefinition: null,
    allowedSources: {
      scrolls: true,
      stimulant: false,
      gems: false,
      itemLevelUp: false,
    },
  };
}

test('returns exactly 1000 deterministic strategies normally', () => {
  const result = enumerateStrategies(makeLargeFixture(1000));
  assert.equal(result.strategies.length, 1000);
  assert.equal(result.total, 1000);
  assert.equal(result.tooManyResults, false);
  assert.ok(result.strategies.every((strategy) =>
    !Object.hasOwn(strategy, 'probability')));
});

test('the 1001st distinct strategy returns only the overflow sentinel', () => {
  const first = enumerateStrategies(makeLargeFixture(1001));
  const second = enumerateStrategies(makeLargeFixture(1001));
  assert.deepEqual(first, {
    strategies: [],
    total: 1001,
    tooManyResults: true,
  });
  assert.deepEqual(first, second);
});
```

Update earlier normal-result assertions from `truncated === false` to `tooManyResults === false`.

- [ ] **Step 2: Run the boundary tests and verify failure**

Run: `node --test tests/deconstruction-engine.test.mjs`

Expected: FAIL because the engine still stops at 500 and returns `truncated`.

- [ ] **Step 3: Implement 1,001st-result detection**

At module scope, replace `MAX_STRATEGIES` with the display and proof boundaries:

```js
const MAX_DISPLAY_STRATEGIES = 1000;
const OVERFLOW_TOTAL = MAX_DISPLAY_STRATEGIES + 1;
```

Convert `enumerateExactCountScrollStates` from a capped array builder to a lazy generator so the engine can continue until it finds the 1,001st exact match rather than stopping after an unrelated number of intermediate scroll states:

```js
function* enumerateExactCountScrollStates({
  scrolls: allScrolls,
  targetKeys,
  targetDeltas,
  successfulScrollCount,
  correctionBounds,
}) {
  const requiredScrollCount = (() => {
    try {
      const n = Number(successfulScrollCount);
      return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
    } catch {
      return 0;
    }
  })();
  if (requiredScrollCount === 0) return;

  const relevantScrolls = allScrolls.filter((scroll) =>
    targetKeys.some((key) => (scroll.stats?.[key] || 0) !== 0));
  if (relevantScrolls.length === 0) return;

  const fixedScrolls = relevantScrolls
    .filter((scroll) => !isChaosScroll(scroll))
    .sort((left, right) => left.id - right.id);
  const chaosScrolls = relevantScrolls
    .filter((scroll) => isChaosScroll(scroll))
    .sort((left, right) => left.id - right.id);
  const chaosPool = [];
  for (const scroll of chaosScrolls) {
    for (const deltas of generateChaosDeltas(scroll.stats)) {
      chaosPool.push({ baseScroll: scroll, deltas });
    }
  }

  function* visit(fixedIndex, remainingApps, currentStats, chosen) {
    if (remainingApps === 0 && chosen.length === requiredScrollCount) {
      yield { scrolls: [...chosen], stats: { ...currentStats } };
      return;
    }
    if (remainingApps <= 0 || chosen.length >= requiredScrollCount) return;

    for (let index = fixedIndex; index < fixedScrolls.length; index++) {
      const scroll = fixedScrolls[index];
      let maxUses = remainingApps;
      for (const key of targetKeys) {
        const delta = scroll.stats[key] || 0;
        const remaining = targetDeltas[key] - (currentStats[key] || 0);
        if (delta > 0 && remaining > 0) {
          maxUses = Math.min(maxUses, Math.floor(remaining / delta));
        }
      }
      if (maxUses <= 0) continue;

      for (let count = maxUses; count >= 1; count--) {
        const nextStats = { ...currentStats };
        for (const [key, value] of Object.entries(scroll.stats)) {
          if (Number.isFinite(value) && targetKeys.includes(key)) {
            nextStats[key] = (nextStats[key] || 0) + value * count;
          }
        }
        const nextChosen = [...chosen];
        for (let copy = 0; copy < count; copy++) {
          nextChosen.push({
            id: scroll.id,
            nameKo: scroll.nameKo,
            stats: { ...scroll.stats },
          });
        }
        yield* visit(index + 1, remainingApps - count, nextStats, nextChosen);
      }
    }

    for (const { baseScroll, deltas } of chaosPool) {
      const nextStats = { ...currentStats };
      for (const [key, value] of Object.entries(deltas)) {
        if (targetKeys.includes(key)) {
          nextStats[key] = (nextStats[key] || 0) + value;
        }
      }
      yield* visit(fixedIndex, remainingApps - 1, nextStats, [
        ...chosen,
        { ...baseScroll, stats: { ...deltas } },
      ]);
    }
  }

  yield* visit(
    0,
    requiredScrollCount,
    Object.fromEntries(targetKeys.map((key) => [key, 0])),
    [],
  );
}
```

Change the scroll-state setup to use the generator directly and retain the single empty base only for zero successful scrolls:

```js
  const effectiveScrollStates = normCount === 0
    ? [{
        scrolls: [],
        stats: Object.fromEntries(targetKeys.map((key) => [key, 0])),
      }]
    : (allowed.scrolls
        ? enumerateExactCountScrollStates({
            scrolls,
            targetKeys,
            targetDeltas,
            successfulScrollCount: normCount,
            correctionBounds: stimulantBounds,
          })
        : []);
```

Inside `enumerateStrategies`, replace `truncated` with:

```js
  let tooManyResults = false;
```

Implement `addResult` so the 1,001st distinct exact match proves overflow but is not retained:

```js
  function addResult(parts) {
    if (tooManyResults) return;
    const result = buildResult({ ...parts, targetKeys });
    if (!isExactVector(result.totalStats, targetVector, targetKeys)) return;
    const key = strategyCanonicalKey(result, targetKeys);
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    if (strategies.length === MAX_DISPLAY_STRATEGIES) {
      tooManyResults = true;
      return;
    }
    strategies.push(result);
  }
```

Replace loop conditions based on `strategies.length < MAX_STRATEGIES` with `!tooManyResults`, break nested loops when `tooManyResults` becomes true, and add this at the end of the outer `for (const ss of effectiveScrollStates)` body:

```js
    if (tooManyResults) break;
```

Return the explicit contract:

```js
  if (tooManyResults) {
    return {
      strategies: [],
      total: OVERFLOW_TOTAL,
      tooManyResults: true,
    };
  }

  return {
    strategies,
    total: strategies.length,
    tooManyResults: false,
  };
```

- [ ] **Step 4: Run engine tests**

Run: `node --test tests/deconstruction-engine.test.mjs`

Expected: PASS, including exactly 1,000 and overflow at 1,001.

- [ ] **Step 5: Commit the overflow change**

```bash
git add src/lib/deconstruction/engine.mjs tests/deconstruction-engine.test.mjs
git commit -m "feat: limit deconstruction results to one thousand"
```

### Task 3: Add Step 3 source controls and validation

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs`
- Modify: `src/pages/deconstruction.astro:225-245,320-390,780-790,850-875,1075-1140,1500-1660`

- [ ] **Step 1: Write failing UI contract tests for controls and validation**

Append:

```js
test('calculation panel exposes source controls with scrolls as the only default', () => {
  assert.match(pageSource, /분석에 사용할 강화 유형/);
  assert.match(pageSource, /data-decon-source="scrolls"[^>]*checked/);
  for (const source of ['stimulant', 'gems', 'itemLevelUp']) {
    assert.match(pageSource, new RegExp(`data-decon-source="${source}"`));
  }
  assert.match(pageSource, /data-decon-level-up-source[^>]*hidden/);
  assert.match(pageSource, /data-decon-source-message/);
});

test('source selection resets per item and level-up follows loaded item data', () => {
  assert.match(pageSource, /resetAllowedSources\(item\)/);
  assert.match(pageSource, /itemLevelUpByItemId\.has\(item\.id\)/);
  assert.match(pageSource, /renderAllowedSourceControls\(selectedItem, \{ reset: false \}\)/);
});

test('source validation disables analysis and explains invalid states', () => {
  assert.match(pageSource, /분석에 사용할 강화 유형을 하나 이상 선택해주세요/);
  assert.match(pageSource, /주문서 성공 횟수가 1회 이상으로 설정되어 있어 주문서를 제외할 수 없습니다\./);
  assert.match(pageSource, /성공한 주문서가 있는 아이템은 주문서를 사용하지 않은 전략으로 분석할 수 없습니다\./);
  assert.match(pageSource, /deconAnalyzeBtn\.disabled = checkedCount === 0 \|\| sourceError !== ''/);
});
```

- [ ] **Step 2: Run UI contract tests and verify failure**

Run: `node --test tests/deconstruction-ui-contract.test.mjs`

Expected: FAIL because the source controls and validation do not exist.

- [ ] **Step 3: Add source-control markup**

Insert between target chips and `분석 시작`:

```astro
<div class="decon-source-controls" data-decon-source-controls>
  <p class="decon-source-title">분석에 사용할 강화 유형</p>
  <div class="ev-target-chip-grid decon-source-chip-grid">
    <label class="ev-target-chip">
      <input type="checkbox" data-decon-source="scrolls" checked />
      <span class="ev-target-chip-label">주문서</span>
    </label>
    <label class="ev-target-chip">
      <input type="checkbox" data-decon-source="stimulant" />
      <span class="ev-target-chip-label">촉진제</span>
    </label>
    <label class="ev-target-chip">
      <input type="checkbox" data-decon-source="gems" />
      <span class="ev-target-chip-label">보석</span>
    </label>
    <label class="ev-target-chip" data-decon-level-up-source hidden>
      <input type="checkbox" data-decon-source="itemLevelUp" />
      <span class="ev-target-chip-label">레벨업</span>
    </label>
  </div>
  <p class="decon-source-message" data-decon-source-message hidden></p>
</div>
```

- [ ] **Step 4: Add DOM references and source-state helpers**

Add references beside the target-chip reference:

```js
const deconSourceInputs = document.querySelectorAll('[data-decon-source]');
const deconLevelUpSource = document.querySelector('[data-decon-level-up-source]');
const deconSourceMessage = document.querySelector('[data-decon-source-message]');
```

Add helpers before `updateAnalyzeButton`:

```js
const getAllowedSources = () => Object.fromEntries(
  [...deconSourceInputs].map((input) => [
    input.dataset.deconSource,
    input instanceof HTMLInputElement && input.checked && !input.closest('[hidden]'),
  ]),
);

const renderAllowedSourceControls = (item, { reset = false } = {}) => {
  for (const input of deconSourceInputs) {
    if (!(input instanceof HTMLInputElement)) continue;
    if (reset) input.checked = input.dataset.deconSource === 'scrolls';
  }
  if (deconLevelUpSource instanceof HTMLElement) {
    const eligible = item != null && itemLevelUpByItemId.has(item.id);
    deconLevelUpSource.hidden = !eligible;
    const input = deconLevelUpSource.querySelector('input');
    if (!eligible && input instanceof HTMLInputElement) input.checked = false;
  }
  updateAnalyzeButton();
};

const resetAllowedSources = (item) => {
  renderAllowedSourceControls(item, { reset: true });
};

const getSourceValidationMessage = () => {
  const allowedSources = getAllowedSources();
  if (!Object.values(allowedSources).some(Boolean)) {
    return '분석에 사용할 강화 유형을 하나 이상 선택해주세요';
  }
  if (!allowedSources.scrolls && deconSlotState.successfulScrollCount > 0) {
    return '주문서 성공 횟수가 1회 이상으로 설정되어 있어 주문서를 제외할 수 없습니다. 성공한 주문서가 있는 아이템은 주문서를 사용하지 않은 전략으로 분석할 수 없습니다.';
  }
  return '';
};
```

- [ ] **Step 5: Integrate validation and lifecycle updates**

Replace `updateAnalyzeButton` with:

```js
const updateAnalyzeButton = () => {
  if (!(deconAnalyzeBtn instanceof HTMLButtonElement)) return;
  const checkedCount = deconTargetChips?.querySelectorAll('input:checked').length ?? 0;
  const sourceError = getSourceValidationMessage();
  deconAnalyzeBtn.disabled = checkedCount === 0 || sourceError !== '';
  if (deconSourceMessage instanceof HTMLElement) {
    deconSourceMessage.textContent = sourceError;
    deconSourceMessage.hidden = sourceError === '';
  }
};
```

Then:

- Call `updateAnalyzeButton()` at the end of `renderDeconSlotState()` so changing the successful-scroll count immediately updates the conflict state.
- Register `change` listeners on every source input that call `updateAnalyzeButton()`.
- Call `resetAllowedSources(item)` in `selectSuggestedItem` after assigning `selectedItem` and before activating the edit panel.
- Call `resetAllowedSources(selectedItem)` in the confirmed reset flow.
- After `itemLevelUpByItemId` is populated, call `renderAllowedSourceControls(selectedItem, { reset: false })` when an item is already selected. This handles either asynchronous load order without resetting user choices.

- [ ] **Step 6: Add focused styles**

Add styles near the other deconstruction-specific calculation styles:

```css
.decon-source-controls {
  margin-top: 12px;
}

.decon-source-title {
  margin: 0 0 8px;
  color: var(--ink);
  font-size: 0.88rem;
  font-weight: 700;
}

.decon-source-chip-grid {
  margin-bottom: 8px;
}

.decon-source-message {
  margin: 0 0 8px;
  color: var(--danger, #d14343);
  font-size: 0.82rem;
  line-height: 1.45;
}

.decon-source-message[hidden] {
  display: none;
}
```

- [ ] **Step 7: Run UI contract tests**

Run: `node --test tests/deconstruction-ui-contract.test.mjs`

Expected: PASS.

- [ ] **Step 8: Commit the Step 3 controls**

```bash
git add src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git commit -m "feat: add deconstruction source controls"
```

### Task 4: Wire permissions into analysis and render overflow guidance

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs`
- Modify: `src/pages/deconstruction.astro:1100-1200`

- [ ] **Step 1: Write failing wiring and overflow contract tests**

Append:

```js
test('analysis passes selected source permissions to the engine', () => {
  const runAnalysisStart = pageSource.indexOf('const runAnalysis = () => {');
  const displayResultsStart = pageSource.indexOf('// ---- Display results ----', runAnalysisStart);
  const runAnalysisSource = pageSource.slice(runAnalysisStart, displayResultsStart);
  assert.match(runAnalysisSource, /allowedSources:\s*getAllowedSources\(\)/);
});

test('overflow clears dynamic results and shows target-tightening guidance', () => {
  const displayResultsStart = pageSource.indexOf('const displayResults = (result, targetDeltas) => {');
  const filterStart = pageSource.indexOf('// ---- Filter ----', displayResultsStart);
  const displayResultsSource = pageSource.slice(displayResultsStart, filterStart);
  assert.match(displayResultsSource, /if \(result\.tooManyResults\)/);
  assert.match(displayResultsSource, /일치하는 전략이 1,000개를 초과합니다\. 위 패널에서 목표 조건을 더 구체적으로 선택해주세요\./);
  assert.match(displayResultsSource, /filterChipsContainer\.replaceChildren\(\)/);
  assert.match(displayResultsSource, /listContainer\.replaceChildren\(\)/);
  assert.doesNotMatch(displayResultsSource, /result\.truncated/);
});
```

- [ ] **Step 2: Run UI tests and verify failure**

Run: `node --test tests/deconstruction-ui-contract.test.mjs`

Expected: FAIL because the engine call omits permissions and the result view still reads `truncated`.

- [ ] **Step 3: Pass permissions into the engine**

Add this property to the existing `enumerateStrategies` call in `runAnalysis`:

```js
    allowedSources: getAllowedSources(),
```

- [ ] **Step 4: Render the overflow state before normal empty handling**

After clearing `filterChipsContainer` and `listContainer` and creating the summary, insert:

```js
  if (result.tooManyResults) {
    summary.textContent = '일치하는 전략이 1,000개를 초과합니다. 위 패널에서 목표 조건을 더 구체적으로 선택해주세요.';
    return;
  }
```

Keep the existing no-match branch after it. Replace the truncated total formatting with:

```js
  summary.textContent = `총 ${result.total}개의 전략을 찾았습니다.`;
```

- [ ] **Step 5: Run focused UI and engine tests**

Run: `node --test tests/deconstruction-ui-contract.test.mjs tests/deconstruction-engine.test.mjs`

Expected: PASS.

- [ ] **Step 6: Commit analysis wiring and overflow UI**

```bash
git add src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git commit -m "feat: show deconstruction result overflow guidance"
```

### Task 5: Full verification

**Files:**
- Verify: `src/lib/deconstruction/engine.mjs`
- Verify: `src/pages/deconstruction.astro`
- Verify: `tests/deconstruction-engine.test.mjs`
- Verify: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Run the full test suite**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: data sync and Astro production build complete successfully with exit code 0.

- [ ] **Step 3: Inspect the final diff for scope and whitespace errors**

Run: `git diff --check HEAD~4..HEAD && git status --short`

Expected: no whitespace errors; only the four planned source/test files are changed by the implementation commits. The pre-existing untracked `.superpowers/` directory remains untouched.

- [ ] **Step 4: Perform browser verification on `/deconstruction`**

Run: `npm run dev`

Verify in the local browser:

1. Select a regular item: 주문서 is checked; other sources are unchecked; 레벨업 is absent.
2. Select an eligible 리버스/타임리스 item: 레벨업 appears unchecked.
3. Uncheck all types: the approved selection message appears and analysis is disabled.
4. Set successful scrolls above zero and uncheck 주문서: the approved impossibility explanation appears and analysis is disabled.
5. Set successful scrolls to zero, enable a non-scroll type, and analyze a matching target: returned cards contain only allowed source types.
6. Change stats and target chips: source choices persist.
7. Select another item: source choices reset to 주문서 only.
8. Confirm the overflow fixture through automated coverage; production data need not naturally produce more than 1,000 matches during manual verification.

- [ ] **Step 5: Record verification without making unrelated changes**

Run: `git status --short`

Expected: clean tracked worktree. Do not add or remove the unrelated `.superpowers/` directory.
