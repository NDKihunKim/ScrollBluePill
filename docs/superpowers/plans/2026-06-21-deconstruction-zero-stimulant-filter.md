# Deconstruction Zero Stimulant Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `+0` 촉진제/추옵 result-filter checkbox for strategies with no stimulant, with an empty stimulant selection producing the same no-source-only result.

**Architecture:** Keep strategy enumeration unchanged and represent absence only inside the pure result-filter model as `stimulant:none`. Give every strategy exactly one stimulant facet option, apply the empty-set fallback while matching that facet, and let the existing controller render and persist the synthetic option without a second UI path.

**Tech Stack:** Astro, browser-native JavaScript modules, Node.js test runner, Playwright Chromium.

---

## File Structure

- Modify `src/lib/deconstruction/resultFilters.mjs`: define the synthetic no-source option, empty-selection matching rule, and deterministic stimulant sign ordering.
- Modify `tests/deconstruction-result-filters.test.mjs`: specify option identity, fallback matching, ordering, and cross-facet availability at the pure-model boundary.
- Modify `tests/deconstruction-result-filter-controller.test.mjs`: execute checkbox interactions in Chromium and verify count, visibility, persistence, fallback, and reset behavior.

No engine, strategy-card, or Astro page changes are expected. If implementation requires one, stop and re-check the design before expanding scope.

### Task 1: Add the synthetic no-stimulant option to the pure model

**Files:**
- Modify: `tests/deconstruction-result-filters.test.mjs:46-137`
- Modify: `src/lib/deconstruction/resultFilters.mjs:3-101`

- [ ] **Step 1: Write failing normalization and initial-selection assertions**

Extend the existing normalization and model-construction tests:

```js
const noStimulant = getStrategySecondaryOptions(strategies[0]);
assert.deepEqual(noStimulant.stimulant, [{
  source: 'stimulant',
  key: 'stimulant:none',
  label: '+0',
  sortGroup: 1,
  sortKey: '+0',
}]);

assert.deepEqual(
  [...selections.get('stimulant')].sort(),
  ['stimulant:dex:-1|str:3', 'stimulant:none'],
);
```

- [ ] **Step 2: Run the model test and confirm the red state**

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: FAIL because null stimulants currently produce no option.

- [ ] **Step 3: Add the minimal synthetic option and ordering metadata**

In `resultFilters.mjs`, add:

```js
const STIMULANT_NONE_KEY = 'stimulant:none';

const stimulantSortGroup = (stats = {}) => {
  const values = Object.values(stats).filter((value) => Number.isFinite(value) && value !== 0);
  if (values.length === 0) return 1;
  return values.every((value) => value < 0) ? 0 : 2;
};
```

Replace stimulant normalization with:

```js
const stimulant = strategy.stimulant ? [{
  source: 'stimulant',
  key: `stimulant:${canonicalStats(strategy.stimulant.stats)}`,
  label: formatStats(strategy.stimulant.stats),
  sortGroup: stimulantSortGroup(strategy.stimulant.stats),
  sortKey: formatStats(strategy.stimulant.stats),
}] : [{
  source: 'stimulant',
  key: STIMULANT_NONE_KEY,
  label: '+0',
  sortGroup: 1,
  sortKey: '+0',
}];
```

Add the optional group before existing sort keys:

```js
.sort((left, right) =>
  Number(right.available) - Number(left.available)
  || (left.sortGroup ?? 0) - (right.sortGroup ?? 0)
  || left.sortKey.localeCompare(right.sortKey)
  || left.key.localeCompare(right.key));
```

- [ ] **Step 4: Run the model test and confirm the first green state**

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: the new normalization assertions and all existing model tests PASS.

- [ ] **Step 5: Write failing fallback and complete semantic coverage**

Append:

```js
test('zero stimulant selection and an empty stimulant selection both show no-source strategies', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);
  const stimulant = selections.get('stimulant');

  stimulant.clear();
  stimulant.add('stimulant:none');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [0, 1, 3]);

  stimulant.clear();
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [0, 1, 3]);
});

test('nonzero stimulant selections exclude no-source strategies when zero is unchecked', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);
  selections.get('stimulant').delete('stimulant:none');
  assert.deepEqual(getVisibleStrategyIndexes(model, selections), [2]);
});

test('stimulant options order negative-only, zero, then positive and mixed outcomes', () => {
  const input = [
    { stimulant: { stats: { str: 2, dex: -1 } } },
    { stimulant: null },
    { stimulant: { stats: { str: -2 } } },
    { stimulant: { stats: { str: 1 } } },
  ];
  const model = buildSecondaryFilterModel(input);
  const selections = createInitialSecondarySelections(model);
  assert.deepEqual(
    getFacetOptions(model, selections, 'stimulant').map(({ key }) => key),
    ['stimulant:str:-2', 'stimulant:none', 'stimulant:str:1', 'stimulant:dex:-1|str:2'],
  );
});

test('other facets can disable zero without clearing its saved state', () => {
  const model = buildSecondaryFilterModel(strategies);
  const selections = createInitialSecondarySelections(model);
  selections.get('gems').clear();
  selections.get('itemLevelUp').clear();
  const zero = getFacetOptions(model, selections, 'stimulant')
    .find(({ key }) => key === 'stimulant:none');
  assert.equal(zero.available, false);
  assert.equal(selections.get('stimulant').has('stimulant:none'), true);
});
```

- [ ] **Step 6: Run the model test and confirm only the fallback remains red**

```bash
node --test tests/deconstruction-result-filters.test.mjs
```

Expected: FAIL at the empty stimulant selection because general matching rejects every stimulant option.

- [ ] **Step 7: Implement the source-specific empty-selection fallback**

```js
function optionIsAllowed(source, key, checked) {
  if (!(checked instanceof Set)) return false;
  if (source === 'stimulant' && checked.size === 0) return key === STIMULANT_NONE_KEY;
  return checked.has(key);
}

function entryMatches(entry, selections, ignoredSource = null) {
  return Object.entries(entry.optionsBySource).every(([source, options]) => {
    if (source === ignoredSource || options.length === 0) return true;
    const checked = selections.get(source);
    return options.every(({ key }) => optionIsAllowed(source, key, checked));
  });
}
```

- [ ] **Step 8: Run tests, check the diff, and commit**

```bash
node --test tests/deconstruction-result-filters.test.mjs
git diff --check
```

Expected: all model tests PASS and the diff check exits 0.

```bash
git add src/lib/deconstruction/resultFilters.mjs tests/deconstruction-result-filters.test.mjs
git commit -m "feat: add zero stimulant result option"
```

### Task 2: Prove the user interactions in Chromium

**Files:**
- Modify: `tests/deconstruction-result-filter-controller.test.mjs:11-152`

- [ ] **Step 1: Expose fixture strategies for reset coverage**

Replace the local strategy array inside the fixture with:

```js
window.testStrategies = [
  { scrolls: [{ id: 'a', nameKo: 'A' }], stimulant: { stats: { str: 1 } }, gems: [], itemLevelUp: null },
  { scrolls: [{ id: 'b', nameKo: 'B' }], stimulant: { stats: { str: 2 } }, gems: [], itemLevelUp: null },
  { scrolls: [{ id: 'c', nameKo: 'C' }], stimulant: null, gems: [], itemLevelUp: null },
];
window.controller.initialize(window.testStrategies);
```

- [ ] **Step 2: Add executable checkbox and fallback coverage**

Append:

```js
test('zero stimulant checkbox and an empty selection both show no-source strategies', async (t) => {
  t.after(() => page.close());
  await page.locator('[data-decon-filter="stimulant"]').click();
  assert.deepEqual(
    await page.locator('[data-decon-option-key]').evaluateAll((labels) =>
      labels.map((label) => [label.dataset.deconOptionKey, label.textContent.trim()])),
    [
      ['stimulant:none', '+0'],
      ['stimulant:str:1', 'STR +1'],
      ['stimulant:str:2', 'STR +2'],
    ],
  );

  await page.locator('[data-decon-option-key="stimulant:str:1"] input').click();
  await page.locator('[data-decon-option-key="stimulant:str:2"] input').click();
  assert.deepEqual(
    await page.locator('.decon-strategy-card:visible').evaluateAll((cards) =>
      cards.map((card) => card.dataset.strategyIndex)),
    ['2'],
  );
  assert.equal(await page.locator('[data-decon-filter="all"]').textContent(), '전체 (1)');

  await page.locator('[data-decon-option-key="stimulant:none"] input').click();
  assert.equal(await page.locator('[data-decon-option-key="stimulant:none"] input').isChecked(), false);
  assert.deepEqual(
    await page.locator('.decon-strategy-card:visible').evaluateAll((cards) =>
      cards.map((card) => card.dataset.strategyIndex)),
    ['2'],
  );

  await page.locator('[data-decon-option-key="stimulant:str:1"] input').click();
  assert.deepEqual(
    await page.locator('.decon-strategy-card:visible').evaluateAll((cards) =>
      cards.map((card) => card.dataset.strategyIndex)),
    ['0'],
  );
});
```

- [ ] **Step 3: Add new-analysis reset coverage**

```js
test('initializing a new analysis rechecks zero and returns to all results', async (t) => {
  t.after(() => page.close());
  await page.locator('[data-decon-filter="stimulant"]').click();
  await page.locator('[data-decon-option-key="stimulant:none"] input').click();
  await page.evaluate(() => {
    window.controller.reset();
    window.controller.initialize(window.testStrategies);
  });

  assert.equal(await page.locator('[data-decon-filter="all"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('[data-decon-secondary-filters]').isHidden(), true);
  assert.equal(await page.locator('[data-decon-filter="all"]').textContent(), '전체 (3)');
  assert.equal(await page.locator('.decon-strategy-card:visible').count(), 3);
  await page.locator('[data-decon-filter="stimulant"]').click();
  assert.equal(await page.locator('[data-decon-option-key="stimulant:none"] input').isChecked(), true);
});
```

- [ ] **Step 4: Run focused interaction tests**

```bash
node --test tests/deconstruction-result-filters.test.mjs tests/deconstruction-result-filter-controller.test.mjs
```

Expected: all tests PASS, including real Chromium checkbox, visibility, count, fallback, and reset assertions.

- [ ] **Step 5: Commit interaction coverage**

```bash
git add tests/deconstruction-result-filter-controller.test.mjs
git commit -m "test: cover zero stimulant filter interactions"
```

### Task 3: Run regression and browser acceptance verification

**Files:**
- Verify only; no planned modifications.

- [ ] **Step 1: Run the focused deconstruction suite**

```bash
node --test tests/deconstruction-result-filters.test.mjs tests/deconstruction-result-filter-controller.test.mjs tests/deconstruction-ui-contract.test.mjs tests/deconstruction-engine.test.mjs tests/deconstruction-source-contributions.test.mjs
```

Expected: zero failures.

- [ ] **Step 2: Run the standard project suite**

```bash
node --test tests/*.test.mjs
```

Expected: zero failures; record fresh pass and skip totals.

- [ ] **Step 3: Build the Astro site**

```bash
npx astro build
```

Expected: exit 0 and all static routes build. Do not use the data-sync wrapper unless Supabase credentials are present.

- [ ] **Step 4: Perform actual-page browser acceptance**

Start the development server, open `/deconstruction`, and generate strategies with both real stimulant outcomes and no stimulant. Verify:

1. `+0` appears between negative-only and positive or mixed outcomes.
2. Only `+0` checked shows only no-source strategies.
3. Every stimulant checkbox visibly unchecked produces the same result set.
4. A nonzero option checked while `+0` is unchecked excludes no-source strategies.
5. Tab changes and `전체 (n)` preserve states and effective count.
6. A new analysis rechecks all options and returns to `전체`.
7. The browser console has no errors.

- [ ] **Step 5: Verify repository cleanliness**

```bash
git diff --check
git status --short --branch
```

Expected: the diff check exits 0 and the feature branch has no uncommitted changes.
