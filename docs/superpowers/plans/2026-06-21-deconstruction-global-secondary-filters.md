# Deconstruction Global Secondary Filters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make primary result chips navigate one secondary panel at a time while persistent secondary exclusions filter all strategies and update `전체 (n)` dynamically.

**Architecture:** Build one pure secondary-filter model from every returned strategy, independent of the active primary tab. Keep global allowed-option sets as matching state and a separate nullable `activePanelSource` as presentation state. Update the active panel in place after checkbox changes so cross-facet ordering changes without rebuilding controls or losing focus.

**Tech Stack:** Astro 6, JavaScript ES modules, browser DOM APIs, Node.js test runner

---

## Working-Tree Constraint

`src/pages/deconstruction.astro` and `tests/deconstruction-ui-contract.test.mjs` already contain a verified but uncommitted confirmation-state bug fix. Commit that fix separately before changing filter behavior so both diffs remain auditable.

## File Structure

- Modify `src/lib/deconstruction/resultFilters.mjs`: build one model from all strategies and all source options.
- Modify `tests/deconstruction-result-filters.test.mjs`: specify global exclusions and cross-facet availability.
- Modify `src/pages/deconstruction.astro`: separate active-panel state from persistent filter state, render one panel, update counts, and reorder the active panel in place.
- Modify `tests/deconstruction-ui-contract.test.mjs`: replace exact-primary contracts with tab-navigation and dynamic-count contracts while preserving confirmation regression coverage.

### Task 0: Preserve the completed confirmation-state fix

**Files:**
- Verify and commit: `src/pages/deconstruction.astro`
- Verify and commit: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Re-run the focused confirmation regression**

Run:

```bash
node --test --test-name-pattern="guarded calculation checkboxes" tests/deconstruction-ui-contract.test.mjs
```

Expected: the guarded calculation checkbox test PASSes.

- [ ] **Step 2: Review and commit only the existing fix**

Run:

```bash
git diff --check -- src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git diff -- src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
```

Expected: the diff contains `guardDeconCheckboxMutation`, its two section-3 integrations, and the regression contract only.

Commit:

```bash
git add src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git commit -m "fix: restore cancelled deconstruction checkbox changes"
```

### Task 1: Make the pure filter model global

**Files:**
- Modify: `tests/deconstruction-result-filters.test.mjs`
- Modify: `src/lib/deconstruction/resultFilters.mjs:48-69`

- [ ] **Step 1: Replace exact-primary tests with global-model tests**

Replace every `buildSecondaryFilterModel(strategies, new Set(...))` call with `buildSecondaryFilterModel(strategies)`. Replace the second through sixth tests with:

```js
test('builds one global strategy and option universe', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  assert.deepEqual(RESULT_SOURCE_ORDER, ['scrolls', 'stimulant', 'gems', 'itemLevelUp']);
  assert.deepEqual(model.entries.map(({ strategyIndex }) => strategyIndex), [0, 1, 2, 3]);
  assert.deepEqual([...selections.get('scrolls')].sort(), ['scroll:1001', 'scroll:1002']);
  assert.deepEqual([...selections.get('gems')].sort(), ['gem:dexCrystal:1', 'gem:strCrystal:2']);
  assert.deepEqual([...selections.get('stimulant')], ['stimulant:dex:-1|str:3']);
  assert.deepEqual([...selections.get('itemLevelUp')], ['level:dex:2|str:3']);
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [0, 1, 2, 3]);
});

test('unchecked enhancements exclude matching strategies while unrelated-source strategies remain', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);

  selections.get('scrolls').delete('scroll:1001');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [1, 2, 3]);

  selections.get('gems').delete('gem:dexCrystal:1');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [2, 3]);
});

test('hidden facet selections move incompatible active-facet options to the disabled tail', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);
  selections.get('gems').delete('gem:strCrystal:2');

  assert.deepEqual(
    getFacetOptions(model, selections, 'scrolls').map(({ key, available }) => ({ key, available })),
    [
      { key: 'scroll:1002', available: true },
      { key: 'scroll:1001', available: false },
    ],
  );
  assert.equal(selections.get('scrolls').has('scroll:1001'), true);
});

test('an emptied facet remains recoverable and does not exclude unrelated-source strategies', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);
  selections.get('scrolls').clear();

  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [2, 3]);
  assert.ok(getFacetOptions(model, selections, 'scrolls').every(({ available }) => available));
  assert.ok(getFacetOptions(model, selections, 'gems').every(({ available }) => !available));
});

test('global model output is deterministic when strategy input order changes', () => {
  const forward = buildSecondaryFilterModel(strategies);
  const reversed = buildSecondaryFilterModel([...strategies].reverse());
  const forwardSelections = createInitialSecondarySelections(forward);
  const reversedSelections = createInitialSecondarySelections(reversed);

  for (const source of RESULT_SOURCE_ORDER) {
    assert.deepEqual(
      getFacetOptions(forward, forwardSelections, source).map(({ key }) => key),
      getFacetOptions(reversed, reversedSelections, source).map(({ key }) => key),
    );
  }
});
```

- [ ] **Step 2: Run the model tests and verify failure**

Run:

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: FAIL because the current builder requires a selected-source set and filters out strategies that do not exactly match it.

- [ ] **Step 3: Remove exact source-set matching from model construction**

Delete `sourceSetsMatch`. Replace `buildSecondaryFilterModel` with:

```js
export function buildSecondaryFilterModel(strategies) {
  const entries = strategies.map((strategy, strategyIndex) => ({
    strategyIndex,
    strategy,
    optionsBySource: getStrategySecondaryOptions(strategy),
  }));

  const optionsBySource = new Map();
  for (const source of RESULT_SOURCE_ORDER) {
    const options = entries.flatMap((entry) => entry.optionsBySource[source]);
    optionsBySource.set(source, uniqueOptions(options));
  }
  return { entries, optionsBySource };
}
```

Do not change `entryMatches`, `getFacetOptions`, or `getVisibleStrategyIndexes`; their existing allowed-option semantics already implement global exclusions correctly.

- [ ] **Step 4: Run the focused model tests**

Run:

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: all six tests PASS.

- [ ] **Step 5: Commit the pure model change**

```bash
git add src/lib/deconstruction/resultFilters.mjs tests/deconstruction-result-filters.test.mjs
git commit -m "refactor: make deconstruction secondary filters global"
```

### Task 2: Specify primary tabs, persistent selections, and dynamic counts

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs:136-224`
- Modify: `src/pages/deconstruction.astro:1260-1545`

- [ ] **Step 1: Replace obsolete exact-primary UI contracts**

Keep the label test, but change its count assertion to require an updateable all-chip hook:

```js
assert.match(displaySource, /chip\.dataset\.deconFilter = def\.source \?\? 'all';/);
assert.match(displaySource, /chip\.textContent = def\.source === null\s*\? `\$\{def\.label\} \(\$\{result\.strategies\.length\}\)`\s*:\s*def\.label;/);
```

Replace `result source filters use exact multi-select matching with all fallback` and `primary result changes rebuild or clear secondary filter state` with:

```js
test('primary result chips navigate one panel without owning filter state', () => {
  const filterStart = pageSource.indexOf('// ---- Filter ----');
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', filterStart);
  const filterSource = pageSource.slice(filterStart, listenersStart);

  assert.match(filterSource, /let activePanelSource = null;/);
  assert.doesNotMatch(filterSource, /selectedResultSources/);
  assert.doesNotMatch(filterSource, /sourceSetsMatch/);
  assert.match(filterSource, /activePanelSource = source;/);
  assert.match(
    filterSource,
    /chip\.classList\.toggle\(\s*'decon-filter-chip--active',\s*chipSource === \(activePanelSource \?\? 'all'\),\s*\);/,
  );
  assert.match(filterSource, /if \(activePanelSource === null\) \{[\s\S]*deconSecondaryFilters\.hidden = true;/);
});

test('new results initialize one global model while tab switches preserve selections', () => {
  const displayStart = pageSource.indexOf('const displayResults = (result, targetDeltas) => {');
  const filterStart = pageSource.indexOf('// ---- Filter ----', displayStart);
  const displaySource = pageSource.slice(displayStart, filterStart);
  const setActiveStart = pageSource.indexOf('const setActiveFilter =', filterStart);
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', setActiveStart);
  const setActiveSource = pageSource.slice(setActiveStart, listenersStart);

  assert.match(displaySource, /secondaryFilterModel = buildSecondaryFilterModel\(currentResultStrategies\);/);
  assert.match(displaySource, /selectedSecondaryOptions = createInitialSecondarySelections\(secondaryFilterModel\);/);
  assert.match(displaySource, /setActiveFilter\(null\);/);
  assert.doesNotMatch(setActiveSource, /buildSecondaryFilterModel/);
  assert.doesNotMatch(setActiveSource, /selectedSecondaryOptions\s*=/);
});

test('one filter application controls cards, filtered count, and empty state', () => {
  const filterStart = pageSource.indexOf('// ---- Filter ----');
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', filterStart);
  const filterSource = pageSource.slice(filterStart, listenersStart);

  assert.match(filterSource, /getVisibleStrategyIndexes\(secondaryFilterModel, selectedSecondaryOptions\)/);
  assert.match(filterSource, /allChip\.textContent = `전체 \(\$\{visibleCount\}\)`;/);
  assert.match(filterSource, /filterEmpty\.hidden = visibleCount > 0;/);
});
```

- [ ] **Step 2: Add a contract for one-panel rendering and in-place availability refresh**

Replace `secondary checkboxes update selections, availability, and visible cards immediately` with:

```js
test('only the active secondary panel renders and updates in place', () => {
  const filterStart = pageSource.indexOf('// ---- Filter ----');
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', filterStart);
  const filterSource = pageSource.slice(filterStart, listenersStart);

  assert.match(filterSource, /const renderSecondaryFilterPanel = \(source\) =>/);
  assert.doesNotMatch(filterSource, /for \(const source of RESULT_SOURCE_ORDER/);
  assert.match(filterSource, /label\.dataset\.deconOptionKey = option\.key;/);
  assert.match(filterSource, /const refreshActiveSecondaryPanel = \(\) =>/);
  assert.match(filterSource, /getFacetOptions\(secondaryFilterModel, selectedSecondaryOptions, activePanelSource\)/);
  assert.match(filterSource, /list\.append\(label\);/);
  assert.match(filterSource, /input\.disabled = !option\.available;/);
  assert.match(filterSource, /applySecondaryFilters\(\);\s*refreshActiveSecondaryPanel\(\);/);
});
```

Also replace the import assertion in `result panel exposes a secondary-filter container and imports the pure model` with:

```js
assert.match(
  pageSource,
  /import \{[\s\S]*buildSecondaryFilterModel,[\s\S]*createInitialSecondarySelections,[\s\S]*getFacetOptions,[\s\S]*getVisibleStrategyIndexes,[\s\S]*\} from '\.\.\/lib\/deconstruction\/resultFilters\.mjs';/,
);
assert.doesNotMatch(pageSource, /import \{[\s\S]*RESULT_SOURCE_ORDER,[\s\S]*\} from '\.\.\/lib\/deconstruction\/resultFilters\.mjs';/);
```

- [ ] **Step 3: Run the UI contract and verify failure**

Run:

```bash
node --test tests/deconstruction-ui-contract.test.mjs
```

Expected: FAIL because the page still uses multi-source exact filtering, rebuilds model state on tab clicks, and never updates the all-chip count.

### Task 3: Implement global filter state and one-panel navigation

**Files:**
- Modify: `src/pages/deconstruction.astro:1260-1545`
- Test: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Initialize the global model once per successful analysis**

Replace the `resultFilters.mjs` import in `deconstruction.astro` with:

```js
import {
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getFacetOptions,
  getVisibleStrategyIndexes,
} from '../lib/deconstruction/resultFilters.mjs';
```

At the end of the strategy-card loop, before `setActiveFilter(null)`, add:

```js
  secondaryFilterModel = buildSecondaryFilterModel(currentResultStrategies);
  selectedSecondaryOptions = createInitialSecondarySelections(secondaryFilterModel);
  applySecondaryFilters();
  setActiveFilter(null);
```

Keep the existing early `resetSecondaryFilters()` call so overflow and analysis-level empty states clear stale filter state.

- [ ] **Step 2: Replace exact primary state and reset logic**

Delete `selectedResultSources` and the page-local `sourceSetsMatch`. Add `activePanelSource` and update reset state:

```js
let activePanelSource = null;
let currentResultStrategies = [];
let secondaryFilterModel = null;
let selectedSecondaryOptions = new Map();

const resetSecondaryFilters = () => {
  activePanelSource = null;
  secondaryFilterModel = null;
  selectedSecondaryOptions = new Map();
  if (deconSecondaryFilters instanceof HTMLElement) {
    deconSecondaryFilters.replaceChildren();
    deconSecondaryFilters.hidden = true;
  }
};
```

- [ ] **Step 3: Update cards, count, and empty state from one visible set**

Replace `applySecondaryFilters` with:

```js
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
  const allChip = document.querySelector('[data-decon-filter="all"]');
  if (allChip instanceof HTMLButtonElement) {
    allChip.textContent = `전체 (${visibleCount})`;
  }
  const filterEmpty = document.querySelector('[data-decon-filter-empty]');
  if (filterEmpty instanceof HTMLElement) filterEmpty.hidden = visibleCount > 0;
  return visibleCount;
};
```

- [ ] **Step 4: Render exactly one secondary panel**

Replace `renderSecondaryFilters` with:

```js
const renderSecondaryFilterPanel = (source) => {
  if (!(deconSecondaryFilters instanceof HTMLElement) || !secondaryFilterModel) return;
  deconSecondaryFilters.replaceChildren();

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
    label.dataset.deconOptionKey = option.key;
    label.classList.toggle('decon-secondary-filter-option--unavailable', !option.available);
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = checked.has(option.key);
    input.disabled = !option.available;
    input.addEventListener('change', () => {
      if (input.checked) checked.add(option.key);
      else checked.delete(option.key);
      applySecondaryFilters();
      refreshActiveSecondaryPanel();
    });
    const text = document.createElement('span');
    text.textContent = option.label;
    label.append(input, text);
    list.append(label);
  }

  section.append(heading, list);
  deconSecondaryFilters.append(section);
  deconSecondaryFilters.hidden = false;
};
```

- [ ] **Step 5: Reorder and disable active options without rebuilding them**

Add after `renderSecondaryFilterPanel`:

```js
const refreshActiveSecondaryPanel = () => {
  if (!(deconSecondaryFilters instanceof HTMLElement) || !secondaryFilterModel || !activePanelSource) return;
  const list = deconSecondaryFilters.querySelector('.decon-secondary-filter-options');
  if (!(list instanceof HTMLElement)) return;
  const labels = new Map(
    [...list.querySelectorAll('[data-decon-option-key]')]
      .map((label) => [label.dataset.deconOptionKey, label]),
  );
  for (const option of getFacetOptions(
    secondaryFilterModel,
    selectedSecondaryOptions,
    activePanelSource,
  )) {
    const label = labels.get(option.key);
    if (!(label instanceof HTMLLabelElement)) continue;
    label.classList.toggle('decon-secondary-filter-option--unavailable', !option.available);
    const input = label.querySelector('input');
    if (input instanceof HTMLInputElement) input.disabled = !option.available;
    list.append(label);
  }
};
```

Appending an existing label moves it to the new available-first order while preserving its input, checked state, event listener, and focus.

- [ ] **Step 6: Make primary chips presentation-only tabs**

Replace `setActiveFilter` with:

```js
const setActiveFilter = (source) => {
  activePanelSource = source;
  document.querySelectorAll('[data-decon-filter]').forEach((chip) => {
    const chipSource = chip.dataset.deconFilter;
    chip.classList.toggle(
      'decon-filter-chip--active',
      chipSource === (activePanelSource ?? 'all'),
    );
  });

  if (!(deconSecondaryFilters instanceof HTMLElement)) return;
  if (activePanelSource === null) {
    deconSecondaryFilters.replaceChildren();
    deconSecondaryFilters.hidden = true;
    return;
  }
  renderSecondaryFilterPanel(activePanelSource);
};
```

Do not rebuild `secondaryFilterModel` or `selectedSecondaryOptions` inside this function.

- [ ] **Step 7: Run focused tests and commit the page integration**

Run:

```bash
node --test tests/deconstruction-result-filters.test.mjs tests/deconstruction-ui-contract.test.mjs
git diff --check
```

Expected: all focused tests PASS and `git diff --check` reports no errors.

Review the diff to ensure the previously committed `guardDeconCheckboxMutation` implementation and its regression test remain present and unchanged. Then commit the filter integration:

```bash
git add src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git commit -m "feat: make deconstruction result filters global"
```

### Task 4: Verify the completed interaction

**Files:**
- Verify: `src/lib/deconstruction/resultFilters.mjs`
- Verify: `src/pages/deconstruction.astro`
- Verify: `tests/deconstruction-result-filters.test.mjs`
- Verify: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Run the complete automated suite**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: zero failures; existing intentional skips remain skips.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: exit code 0 and `dist/deconstruction/index.html` exists.

- [ ] **Step 3: Verify in a browser**

Run:

```bash
npm run dev -- --host 127.0.0.1 --port 4321
```

Open `http://127.0.0.1:4321/deconstruction`, generate a result set containing mixed source combinations, and verify:

1. `전체 (n)` starts active, `n` equals all visible cards, and no secondary panel is shown.
2. Each source tab shows only its own secondary panel without changing result membership.
3. Switching tabs preserves every checkbox setting.
4. Unchecking a scroll hides every strategy using it, including mixed strategies, while strategies without that scroll remain.
5. Hidden source exclusions continue affecting cards.
6. `전체 (n)` updates after each checkbox change and matches the visible-card count.
7. Clicking `전체 (n)` hides the panel without resetting or bypassing exclusions.
8. Hidden exclusions move incompatible options to the disabled tail of the active panel.
9. Unchecking every option in one source leaves that source recoverable and shows the no-match message only when no unrelated strategies remain.
10. Running a new analysis resets all options and returns to `전체 (n)`.
11. The result-loss confirmation cancellation still restores section-3 checkbox state; confirmation still applies the change and clears results.

- [ ] **Step 4: Audit final scope**

Run:

```bash
git status --short
git log -4 --oneline
```

Expected: no uncommitted implementation changes. Recent commits contain the pure model refactor, page integration (including the preserved confirmation fix), and the approved design documentation.
