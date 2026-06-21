# Deconstruction Secondary Result Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reactive enhancement-level facets beneath the deconstruction result source chips and restrict item-level-up strategies to item-specific maximum-level totals.

**Architecture:** Change item-level contribution generation at its existing source, then add a pure result-filter model that normalizes strategy enhancements, evaluates allowed-option matching, and computes cross-facet availability. Keep DOM state and rendering in `deconstruction.astro`; checkbox changes filter the already-returned strategy set and never rerun enumeration.

**Tech Stack:** Astro 6, JavaScript ES modules, browser DOM APIs, Node.js test runner

---

## File Structure

- Modify `src/lib/deconstruction/sourceContributions.mjs`: return only deduplicated totals at exactly `maxLevelUps`.
- Modify `tests/deconstruction-source-contributions.test.mjs`: specify maximum-only, item-specific level-up totals.
- Create `src/lib/deconstruction/resultFilters.mjs`: pure enhancement normalization, primary-universe construction, visibility, availability, and sorting.
- Create `tests/deconstruction-result-filters.test.mjs`: unit-test secondary filter semantics independently of the DOM.
- Modify `src/pages/deconstruction.astro`: render secondary sections, maintain selections, and apply the pure model to cards.
- Modify `tests/deconstruction-ui-contract.test.mjs`: verify page wiring and reset behavior.

### Task 1: Restrict item-level contributions to maximum-level totals

**Files:**
- Modify: `tests/deconstruction-source-contributions.test.mjs:17-33`
- Modify: `src/lib/deconstruction/sourceContributions.mjs:57-79`

- [ ] **Step 1: Replace the partial-level test with maximum-only contracts**

Replace `item-level contributions include every count and deduplicate totals` with:

```js
test('item-level contributions include only deduplicated maximum-level totals', () => {
  const results = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 2, statRanges: { str: { min: 0, max: 1 } } },
    targetKeys: ['str'],
    bounds: { str: { min: 0, max: 2 } },
  });

  assert.deepEqual(results, [
    { levelCount: 2, stats: { str: 0 } },
    { levelCount: 2, stats: { str: 1 } },
    { levelCount: 2, stats: { str: 2 } },
  ]);
  assert.ok(results.every(({ levelCount }) => levelCount === 2));
});

test('item-level totals use each item definition maximum and stat ranges', () => {
  const reverse = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 3, statRanges: { str: { min: 1, max: 1 } } },
    targetKeys: ['str'],
    bounds: { str: { min: -Infinity, max: Infinity } },
  });
  const timeless = enumerateItemLevelContributions({
    levelUpDefinition: { maxLevelUps: 5, statRanges: { dex: { min: 0, max: 1 } } },
    targetKeys: ['dex'],
    bounds: { dex: { min: 0, max: 5 } },
  });

  assert.deepEqual(reverse, [{ levelCount: 3, stats: { str: 3 } }]);
  assert.equal(timeless.length, 6);
  assert.ok(timeless.every(({ levelCount }) => levelCount === 5));
  assert.deepEqual(timeless.map(({ stats }) => stats.dex), [0, 1, 2, 3, 4, 5]);
});
```

- [ ] **Step 2: Run the focused test and verify failure**

Run:

```bash
node --test tests/deconstruction-source-contributions.test.mjs
```

Expected: FAIL because the current function also returns levels below `maxLevelUps`.

- [ ] **Step 3: Implement maximum-only enumeration**

Replace `enumerateItemLevelContributions` with:

```js
export function enumerateItemLevelContributions({ levelUpDefinition, targetKeys, bounds }) {
  const maxLevelUps = levelUpDefinition?.maxLevelUps;
  if (!Number.isInteger(maxLevelUps) || maxLevelUps <= 0) return [];

  const oneLevel = enumerateRangeVectors(levelUpDefinition.statRanges ?? {}, targetKeys);
  let previous = [{ stats: Object.fromEntries(targetKeys.map((key) => [key, 0])) }];

  for (let levelCount = 1; levelCount <= maxLevelUps; levelCount++) {
    const seen = new Map();
    for (const base of previous) {
      for (const outcome of oneLevel) {
        const stats = addVectors(base.stats, outcome, targetKeys);
        if (levelCount === maxLevelUps && !withinBounds(stats, bounds, targetKeys)) continue;
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

Bounds are applied to final totals, not intermediate rolls, so a valid maximum-level total is not removed prematurely.

- [ ] **Step 4: Run contribution and engine tests**

Run:

```bash
node --test tests/deconstruction-source-contributions.test.mjs tests/deconstruction-engine.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 5: Commit the maximum-level rule**

```bash
git add src/lib/deconstruction/sourceContributions.mjs tests/deconstruction-source-contributions.test.mjs
git commit -m "fix: require maximum item level-ups in deconstruction"
```

### Task 2: Build the pure secondary-filter model

**Files:**
- Create: `tests/deconstruction-result-filters.test.mjs`
- Create: `src/lib/deconstruction/resultFilters.mjs`

- [ ] **Step 1: Write failing normalization and visibility tests**

Create `tests/deconstruction-result-filters.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  RESULT_SOURCE_ORDER,
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getVisibleStrategyIndexes,
  getStrategySecondaryOptions,
} from '../src/lib/deconstruction/resultFilters.mjs';

const strategies = [
  {
    sourceTypes: ['scrolls', 'gems'],
    scrolls: [
      { id: 1001, nameKo: '힘 주문서', stats: { str: 1 } },
      { id: 1002, nameKo: '민첩 주문서', stats: { dex: 1 } },
    ],
    stimulant: null,
    gems: [{ gemKey: 'strCrystal', nameKo: '힘의 크리스탈', gradeIndex: 2, stats: { str: 5 } }],
    itemLevelUp: null,
  },
  {
    sourceTypes: ['scrolls', 'gems'],
    scrolls: [{ id: 1002, nameKo: '민첩 주문서', stats: { dex: 1 } }],
    stimulant: null,
    gems: [{ gemKey: 'dexCrystal', nameKo: '민첩의 크리스탈', gradeIndex: 1, stats: { dex: 3 } }],
    itemLevelUp: null,
  },
  {
    sourceTypes: ['stimulant'],
    scrolls: [],
    stimulant: { stats: { str: 3, dex: -1, maxHp: 0 } },
    gems: [],
    itemLevelUp: null,
  },
  {
    sourceTypes: ['itemLevelUp'],
    scrolls: [],
    stimulant: null,
    gems: [],
    itemLevelUp: { levelCount: 5, stats: { str: 3, dex: 2 } },
  },
];

test('normalizes source-specific identities and labels', () => {
  const mixed = getStrategySecondaryOptions(strategies[0]);
  assert.deepEqual(mixed.scrolls.map(({ key }) => key), ['scroll:1001', 'scroll:1002']);
  assert.deepEqual(mixed.gems.map(({ key }) => key), ['gem:strCrystal:2']);
  assert.equal(mixed.gems[0].label, '힘의 크리스탈 상급');

  const stimulant = getStrategySecondaryOptions(strategies[2]);
  assert.deepEqual(stimulant.stimulant.map(({ key }) => key), ['stimulant:dex:-1|str:3']);
  assert.equal(stimulant.stimulant[0].label, 'STR +3, DEX -1');

  const level = getStrategySecondaryOptions(strategies[3]);
  assert.deepEqual(level.itemLevelUp.map(({ key }) => key), ['level:dex:2|str:3']);
  assert.equal(level.itemLevelUp[0].label, '5회 총합 — STR +3, DEX +2');
});

test('builds only the exact primary source universe and selects every option initially', () => {
  const model = buildSecondaryFilterModel(strategies, new Set(['scrolls', 'gems']));
  const selections = createInitialSecondarySelections(model);

  assert.deepEqual(RESULT_SOURCE_ORDER, ['scrolls', 'stimulant', 'gems', 'itemLevelUp']);
  assert.deepEqual(model.entries.map(({ strategyIndex }) => strategyIndex), [0, 1]);
  assert.deepEqual([...selections.get('scrolls')].sort(), ['scroll:1001', 'scroll:1002']);
  assert.deepEqual([...selections.get('gems')].sort(), ['gem:dexCrystal:1', 'gem:strCrystal:2']);
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [0, 1]);
});

test('unchecked enhancements exclude every strategy that uses them', () => {
  const model = buildSecondaryFilterModel(strategies, new Set(['scrolls', 'gems']));
  const selections = createInitialSecondarySelections(model);

  selections.get('scrolls').delete('scroll:1001');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [1]);

  selections.get('gems').delete('gem:dexCrystal:1');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), []);
});
```

- [ ] **Step 2: Run the new test and verify module-not-found failure**

Run:

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `resultFilters.mjs`.

- [ ] **Step 3: Implement normalization, model construction, and visibility**

Create `src/lib/deconstruction/resultFilters.mjs`:

```js
import { GEM_GRADES, STAT_KEY_RANK, statLabelByKey } from '../makerData.mjs';

export const RESULT_SOURCE_ORDER = ['scrolls', 'stimulant', 'gems', 'itemLevelUp'];

const canonicalStats = (stats = {}) => Object.entries(stats)
  .filter(([, value]) => Number.isFinite(value) && value !== 0)
  .sort(([left], [right]) => left.localeCompare(right))
  .map(([key, value]) => `${key}:${value}`)
  .join('|') || 'none';

const orderedStats = (stats = {}) => Object.entries(stats)
  .filter(([, value]) => Number.isFinite(value) && value !== 0)
  .sort(([left], [right]) =>
    (STAT_KEY_RANK[left] ?? 999) - (STAT_KEY_RANK[right] ?? 999)
    || left.localeCompare(right));

const formatStats = (stats) => {
  const parts = orderedStats(stats).map(([key, value]) =>
    `${statLabelByKey[key] ?? key} ${value > 0 ? '+' : ''}${value}`);
  return parts.join(', ') || '변화 없음';
};

const uniqueOptions = (options) => [...new Map(options.map((option) => [option.key, option])).values()];

export function getStrategySecondaryOptions(strategy) {
  const scrolls = uniqueOptions((strategy.scrolls ?? []).map((scroll) => ({
    source: 'scrolls',
    key: `scroll:${scroll.id}`,
    label: scroll.nameKo ?? String(scroll.id),
    sortKey: `${scroll.nameKo ?? ''}\u0000${scroll.id}`,
  })));
  const stimulant = strategy.stimulant ? [{
    source: 'stimulant',
    key: `stimulant:${canonicalStats(strategy.stimulant.stats)}`,
    label: formatStats(strategy.stimulant.stats),
    sortKey: formatStats(strategy.stimulant.stats),
  }] : [];
  const gems = uniqueOptions((strategy.gems ?? []).map((gem) => ({
    source: 'gems',
    key: `gem:${gem.gemKey}:${gem.gradeIndex}`,
    label: `${gem.nameKo ?? gem.gemKey} ${GEM_GRADES[gem.gradeIndex] ?? ''}`.trim(),
    sortKey: `${gem.nameKo ?? gem.gemKey}\u0000${gem.gradeIndex}`,
  })));
  const itemLevelUp = strategy.itemLevelUp ? [{
    source: 'itemLevelUp',
    key: `level:${canonicalStats(strategy.itemLevelUp.stats)}`,
    label: `${strategy.itemLevelUp.levelCount}회 총합 — ${formatStats(strategy.itemLevelUp.stats)}`,
    sortKey: formatStats(strategy.itemLevelUp.stats),
  }] : [];

  return { scrolls, stimulant, gems, itemLevelUp };
}

const sourceSetsMatch = (selectedSources, sourceTypes = []) =>
  selectedSources.size === sourceTypes.length
  && sourceTypes.every((source) => selectedSources.has(source));

export function buildSecondaryFilterModel(strategies, selectedSources) {
  const entries = strategies
    .map((strategy, strategyIndex) => ({
      strategyIndex,
      strategy,
      optionsBySource: getStrategySecondaryOptions(strategy),
    }))
    .filter(({ strategy }) => sourceSetsMatch(selectedSources, strategy.sourceTypes ?? []));

  const optionsBySource = new Map();
  for (const source of RESULT_SOURCE_ORDER.filter((entry) => selectedSources.has(entry))) {
    const options = entries.flatMap((entry) => entry.optionsBySource[source]);
    optionsBySource.set(source, uniqueOptions(options));
  }
  return { entries, optionsBySource };
}

export function createInitialSecondarySelections(model) {
  return new Map([...model.optionsBySource].map(([source, options]) => [
    source,
    new Set(options.map(({ key }) => key)),
  ]));
}

function entryMatches(entry, selections, ignoredSource = null) {
  return Object.entries(entry.optionsBySource).every(([source, options]) => {
    if (source === ignoredSource || options.length === 0) return true;
    const checked = selections.get(source);
    return checked instanceof Set && options.every(({ key }) => checked.has(key));
  });
}

export function getVisibleStrategyIndexes(model, selections) {
  return model.entries
    .filter((entry) => entryMatches(entry, selections))
    .map(({ strategyIndex }) => strategyIndex);
}

```

- [ ] **Step 4: Run the model tests**

Run:

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: all three tests PASS.

### Task 3: Specify and implement cross-facet availability

**Files:**
- Modify: `tests/deconstruction-result-filters.test.mjs`
- Verify: `src/lib/deconstruction/resultFilters.mjs`

- [ ] **Step 1: Import availability and add retention, recovery, and determinism tests**

Add `getFacetOptions` to the import from `resultFilters.mjs`, then append:

```js
test('other facet selections move incompatible options to the disabled tail', () => {
  const model = buildSecondaryFilterModel(strategies, new Set(['scrolls', 'gems']));
  const selections = createInitialSecondarySelections(model);
  selections.get('gems').delete('gem:strCrystal:2');

  const scrollOptions = getFacetOptions(model, selections, 'scrolls');
  assert.deepEqual(scrollOptions.map(({ key, available }) => ({ key, available })), [
    { key: 'scroll:1002', available: true },
    { key: 'scroll:1001', available: false },
  ]);
  assert.equal(selections.get('scrolls').has('scroll:1001'), true);
});

test('an emptied facet remains recoverable while other facets become unavailable', () => {
  const model = buildSecondaryFilterModel(strategies, new Set(['scrolls', 'gems']));
  const selections = createInitialSecondarySelections(model);
  selections.get('scrolls').clear();

  assert.deepEqual(getVisibleStrategyIndexes(model, selections), []);
  assert.ok(getFacetOptions(model, selections, 'scrolls').every(({ available }) => available));
  assert.ok(getFacetOptions(model, selections, 'gems').every(({ available }) => !available));
});

test('model output is deterministic when strategy input order changes', () => {
  const forward = buildSecondaryFilterModel(strategies, new Set(['scrolls', 'gems']));
  const reversed = buildSecondaryFilterModel([...strategies].reverse(), new Set(['scrolls', 'gems']));
  const forwardSelections = createInitialSecondarySelections(forward);
  const reversedSelections = createInitialSecondarySelections(reversed);

  assert.deepEqual(
    getFacetOptions(forward, forwardSelections, 'scrolls').map(({ key }) => key),
    getFacetOptions(reversed, reversedSelections, 'scrolls').map(({ key }) => key),
  );
  assert.deepEqual(
    getFacetOptions(forward, forwardSelections, 'gems').map(({ key }) => key),
    getFacetOptions(reversed, reversedSelections, 'gems').map(({ key }) => key),
  );
});
```

- [ ] **Step 2: Run the model test and verify the missing-export failure**

Run:

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: FAIL because `getFacetOptions` is not exported yet.

- [ ] **Step 3: Implement cross-facet availability and deterministic ordering**

Append to `src/lib/deconstruction/resultFilters.mjs`:

```js
export function getFacetOptions(model, selections, source) {
  const availableKeys = new Set(
    model.entries
      .filter((entry) => entryMatches(entry, selections, source))
      .flatMap((entry) => entry.optionsBySource[source].map(({ key }) => key)),
  );
  return (model.optionsBySource.get(source) ?? [])
    .map((option) => ({ ...option, available: availableKeys.has(option.key) }))
    .sort((left, right) =>
      Number(right.available) - Number(left.available)
      || left.sortKey.localeCompare(right.sortKey));
}
```

- [ ] **Step 4: Run the complete model test**

Run:

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: all six tests PASS.

- [ ] **Step 5: Commit the pure filter model**

```bash
git add src/lib/deconstruction/resultFilters.mjs tests/deconstruction-result-filters.test.mjs
git commit -m "feat: add deconstruction secondary filter model"
```

### Task 4: Wire secondary facets into the result panel

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs` after the existing result-filter tests
- Modify: `src/pages/deconstruction.astro:269-273, 302-317, 1240-1460, 2560-2640`

- [ ] **Step 1: Add failing UI contract tests**

Append these tests after `result filters render a dedicated zero-match message...`:

```js
test('result panel exposes a secondary-filter container and imports the pure model', () => {
  assert.match(
    pageSource,
    /data-decon-filter-chips><\/div>\s*<div class="decon-secondary-filters" data-decon-secondary-filters hidden><\/div>/,
  );
  assert.match(
    pageSource,
    /import \{[\s\S]*RESULT_SOURCE_ORDER,[\s\S]*buildSecondaryFilterModel,[\s\S]*createInitialSecondarySelections,[\s\S]*getFacetOptions,[\s\S]*getVisibleStrategyIndexes,[\s\S]*\} from '\.\.\/lib\/deconstruction\/resultFilters\.mjs';/,
  );
});

test('primary result changes rebuild or clear secondary filter state', () => {
  const filterStart = pageSource.indexOf('// ---- Filter ----');
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', filterStart);
  const filterSource = pageSource.slice(filterStart, listenersStart);

  assert.match(filterSource, /let currentResultStrategies = \[\];/);
  assert.match(filterSource, /let secondaryFilterModel = null;/);
  assert.match(filterSource, /let selectedSecondaryOptions = new Map\(\);/);
  assert.match(filterSource, /const resetSecondaryFilters = \(\) =>/);
  assert.match(filterSource, /buildSecondaryFilterModel\(currentResultStrategies, selectedResultSources\)/);
  assert.match(filterSource, /createInitialSecondarySelections\(secondaryFilterModel\)/);
  assert.match(filterSource, /if \(showingAll\) \{[\s\S]*resetSecondaryFilters\(\);/);
});

test('secondary checkboxes update selections, availability, and visible cards immediately', () => {
  const filterStart = pageSource.indexOf('// ---- Filter ----');
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', filterStart);
  const filterSource = pageSource.slice(filterStart, listenersStart);

  assert.match(filterSource, /getFacetOptions\(secondaryFilterModel, selectedSecondaryOptions, source\)/);
  assert.match(filterSource, /input\.checked = checked\.has\(option\.key\);/);
  assert.match(filterSource, /input\.disabled = !option\.available;/);
  assert.match(filterSource, /input\.addEventListener\('change', \(\) =>/);
  assert.match(filterSource, /checked\.(?:add|delete)\(option\.key\)/);
  assert.match(filterSource, /getVisibleStrategyIndexes\(secondaryFilterModel, selectedSecondaryOptions\)/);
  assert.match(filterSource, /renderSecondaryFilters\(\);/);
});
```

- [ ] **Step 2: Run the UI contract and verify failure**

Run:

```bash
node --test tests/deconstruction-ui-contract.test.mjs
```

Expected: FAIL because the secondary container and filter-model wiring do not exist.

- [ ] **Step 3: Add markup, imports, and the secondary container reference**

Insert beneath `data-decon-filter-chips`:

```astro
<div class="decon-secondary-filters" data-decon-secondary-filters hidden></div>
```

Add the import:

```js
import {
  RESULT_SOURCE_ORDER,
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getFacetOptions,
  getVisibleStrategyIndexes,
} from '../lib/deconstruction/resultFilters.mjs';
```

Add beside the result DOM references:

```js
const deconSecondaryFilters = document.querySelector('[data-decon-secondary-filters]');
```

- [ ] **Step 4: Preserve strategy data and stable card indexes during rendering**

At the beginning of `displayResults`, before result-state early returns, add:

```js
  currentResultStrategies = result.strategies ?? [];
  resetSecondaryFilters();
```

Change the strategy loop to use its array index:

```js
  result.strategies.forEach((strategy, strategyIndex) => {
    const card = document.createElement('div');
    card.className = 'decon-strategy-card';
    card.dataset.strategyIndex = String(strategyIndex);
    card.dataset.sourceTypes = strategy.sourceTypes.join(',');

    const headerRow = document.createElement('div');
    headerRow.className = 'decon-strategy-approach';
    headerRow.textContent = `분석 ${strategyIndex + 1}번`;
```

Keep the existing card-body construction unchanged, replace the loop's closing brace with `});`, and retain `setActiveFilter(null);` after the loop.

- [ ] **Step 5: Replace the filter state section with primary and secondary orchestration**

Keep the existing `selectedResultSources` and `sourceSetsMatch`, then add/replace the filter functions with:

```js
const SOURCE_LABELS = {
  scrolls: '주문서',
  stimulant: '촉진제/추옵',
  gems: '보석 (메이커)',
  itemLevelUp: '레벨업',
};

let currentResultStrategies = [];
let secondaryFilterModel = null;
let selectedSecondaryOptions = new Map();

const resetSecondaryFilters = () => {
  secondaryFilterModel = null;
  selectedSecondaryOptions = new Map();
  if (deconSecondaryFilters instanceof HTMLElement) {
    deconSecondaryFilters.replaceChildren();
    deconSecondaryFilters.hidden = true;
  }
};

const applySecondaryFilters = () => {
  if (!secondaryFilterModel) return 0;
  const visibleIndexes = new Set(
    getVisibleStrategyIndexes(secondaryFilterModel, selectedSecondaryOptions),
  );
  let visibleCount = 0;
  document.querySelectorAll('.decon-strategy-card').forEach((card) => {
    const strategyIndex = Number.parseInt(card.dataset.strategyIndex ?? '', 10);
    const matches = visibleIndexes.has(strategyIndex);
    card.hidden = !matches;
    if (matches) visibleCount++;
  });
  const filterEmpty = document.querySelector('[data-decon-filter-empty]');
  if (filterEmpty instanceof HTMLElement) filterEmpty.hidden = visibleCount > 0;
  return visibleCount;
};

const renderSecondaryFilters = () => {
  if (!(deconSecondaryFilters instanceof HTMLElement) || !secondaryFilterModel) return;
  deconSecondaryFilters.replaceChildren();

  for (const source of RESULT_SOURCE_ORDER.filter((entry) => selectedResultSources.has(entry))) {
    const section = document.createElement('section');
    section.className = 'decon-secondary-filter';
    const heading = document.createElement('h3');
    heading.textContent = SOURCE_LABELS[source];
    const list = document.createElement('div');
    list.className = 'decon-secondary-filter-options';

    const checked = selectedSecondaryOptions.get(source) ?? new Set();
    for (const option of getFacetOptions(secondaryFilterModel, selectedSecondaryOptions, source)) {
      const label = document.createElement('label');
      label.className = 'decon-secondary-filter-option';
      label.classList.toggle('decon-secondary-filter-option--unavailable', !option.available);
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = checked.has(option.key);
      input.disabled = !option.available;
      input.addEventListener('change', () => {
        if (input.checked) checked.add(option.key);
        else checked.delete(option.key);
        applySecondaryFilters();
        renderSecondaryFilters();
      });
      const text = document.createElement('span');
      text.textContent = option.label;
      label.append(input, text);
      list.append(label);
    }

    section.append(heading, list);
    deconSecondaryFilters.append(section);
  }
  deconSecondaryFilters.hidden = false;
};

const setActiveFilter = (source) => {
  if (source === null) selectedResultSources.clear();
  else if (selectedResultSources.has(source)) selectedResultSources.delete(source);
  else selectedResultSources.add(source);

  const showingAll = selectedResultSources.size === 0;
  document.querySelectorAll('[data-decon-filter]').forEach((chip) => {
    const chipSource = chip.dataset.deconFilter;
    chip.classList.toggle(
      'decon-filter-chip--active',
      showingAll ? chipSource === 'all' : selectedResultSources.has(chipSource),
    );
  });

  if (showingAll) {
    resetSecondaryFilters();
    document.querySelectorAll('.decon-strategy-card').forEach((card) => { card.hidden = false; });
    const filterEmpty = document.querySelector('[data-decon-filter-empty]');
    if (filterEmpty instanceof HTMLElement) filterEmpty.hidden = true;
    return;
  }

  secondaryFilterModel = buildSecondaryFilterModel(currentResultStrategies, selectedResultSources);
  selectedSecondaryOptions = createInitialSecondarySelections(secondaryFilterModel);
  applySecondaryFilters();
  renderSecondaryFilters();
};
```

- [ ] **Step 6: Add compact scrollable secondary-filter styling**

Add after the primary chip styles:

```css
:global(.decon-secondary-filters) {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 10px;
  margin-bottom: 12px;
}

:global(.decon-secondary-filters[hidden]) {
  display: none;
}

:global(.decon-secondary-filter) {
  min-width: 0;
  padding: 9px;
  border: 1px solid var(--line);
  border-radius: 7px;
  background: color-mix(in srgb, var(--panel) 92%, var(--line));
}

:global(.decon-secondary-filter h3) {
  margin: 0 0 7px;
  font-size: 0.78rem;
  color: var(--ink);
}

:global(.decon-secondary-filter-options) {
  display: grid;
  gap: 5px;
  max-height: 180px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

:global(.decon-secondary-filter-option) {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 0.74rem;
  line-height: 1.35;
  color: var(--ink);
  cursor: pointer;
}

:global(.decon-secondary-filter-option--unavailable) {
  color: var(--muted);
  opacity: 0.58;
  cursor: not-allowed;
}
```

- [ ] **Step 7: Run focused UI and model tests**

Run:

```bash
node --test tests/deconstruction-result-filters.test.mjs tests/deconstruction-ui-contract.test.mjs
```

Expected: all tests PASS.

- [ ] **Step 8: Inspect and commit the UI integration**

Run:

```bash
git diff --check -- src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git diff -- src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
```

Expected: no whitespace errors and no unrelated page changes.

Then commit:

```bash
git add src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git commit -m "feat: add secondary deconstruction result filters"
```

### Task 5: Verify the completed feature

**Files:**
- Verify: `src/lib/deconstruction/sourceContributions.mjs`
- Verify: `src/lib/deconstruction/resultFilters.mjs`
- Verify: `src/pages/deconstruction.astro`
- Verify: `tests/deconstruction-source-contributions.test.mjs`
- Verify: `tests/deconstruction-result-filters.test.mjs`
- Verify: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Run every automated test**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: all tests PASS with zero failures.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code 0 and `dist/deconstruction/index.html` exists.

- [ ] **Step 3: Verify the result facets in a browser**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 4321
```

Open `http://127.0.0.1:4321/deconstruction`, generate actionable mixed-source results, and verify:

1. `전체 (n)` shows all strategies and no secondary sections.
2. Selecting 주문서 shows a scroll section with all scroll IDs prechecked.
3. Unchecking a scroll hides every strategy containing that scroll, including multi-scroll strategies.
4. Selecting multiple primary sources shows all corresponding secondary sections.
5. Gem options are grouped by gem type and grade, not exact rolled stats.
6. Stimulant options represent exact stat outcomes.
7. Other facets shrink reactively: incompatible options move below available options, remain visible, become disabled, and keep their check state.
8. Unchecking all options shows `선택한 조합에 해당하는 전략이 없습니다.` and the emptied section remains recheckable.
9. Returning to `전체 (n)` hides and clears secondary filters.
10. Running a new analysis resets both primary and secondary filters.
11. Item-level-up cards and options use only the selected item's maximum level-up count and aggregate totals.

- [ ] **Step 4: Confirm final scope and repository state**

Run:

```bash
git diff HEAD~3..HEAD --stat
git status --short
```

Expected: committed changes are limited to the six planned source/test files plus this plan if committed separately. Pre-existing `.superpowers/` remains untouched.
