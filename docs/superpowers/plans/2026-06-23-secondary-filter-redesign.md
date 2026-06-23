# Secondary Result Filter Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the uniform checkbox-list secondary filter panel with three source-specific formats: scroll icon rows, gem two-level drill-down, and stimulant stat range sliders.

**Architecture:** `getVisibleStrategyIndexes` gains optional stimulant range filtering. `resultFilterController` splits `renderPanel` into source-specific render functions. Each renderer manages its own DOM but shares the `selections` Map and `applyFilters` callback. Old card-frame CSS is removed; new compact styles added.

**Tech Stack:** Vanilla JS (ESM), Node test runner, Astro

---

### Task 1: Add icon and metadata fields to secondary filter options

**Files:**
- Modify: `src/lib/deconstruction/resultFilters.mjs`

- [ ] **Step 1: Add `iconId` to scroll options, `gemKey`/`gradeIndex` to gem options**

In `getStrategySecondaryOptions`, update the scrolls mapping to include `iconId`:

```js
const scrolls = uniqueOptions((strategy.scrolls ?? []).map((scroll) => ({
  source: 'scrolls',
  key: `scroll:${scroll.id}`,
  label: scroll.nameKo ?? String(scroll.id),
  iconId: scroll.id,
  sortKey: `${scroll.nameKo ?? ''}\0${scroll.id}`,
})));
```

Update the gems mapping to include `gemKey` and `gradeIndex`:

```js
const gems = uniqueOptions((strategy.gems ?? []).map((gem) => ({
  source: 'gems',
  key: `gem:${gem.gemKey}:${gem.gradeIndex}`,
  label: `${gem.nameKo ?? gem.gemKey} ${GEM_GRADES[gem.gradeIndex] ?? ''}`.trim(),
  gemKey: gem.gemKey,
  gradeIndex: gem.gradeIndex,
  sortKey: `${gem.nameKo ?? gem.gemKey}\0${gem.gradeIndex}`,
})));
```

- [ ] **Step 2: Run tests to confirm no regression**

```bash
node --test tests/deconstruction-ui-contract.test.mjs
```
Expected: All pass (the UI contracts don't inspect option internals)

- [ ] **Step 3: Commit**

```bash
git add src/lib/deconstruction/resultFilters.mjs
git commit -m "feat: add iconId and gemKey/gradeIndex metadata to secondary filter options

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Add stimulant range filtering to getVisibleStrategyIndexes

**Files:**
- Modify: `src/lib/deconstruction/resultFilters.mjs`

- [ ] **Step 1: Extend `getVisibleStrategyIndexes` with optional stimulant range parameter**

Change the function signature and body:

```js
export function getVisibleStrategyIndexes(model, selections, stimulantRanges = null) {
  return model.entries
    .filter((entry) => entryMatches(entry, selections) && stimulantInRange(entry, stimulantRanges))
    .map(({ strategyIndex }) => strategyIndex);
}
```

Add the helper function above it:

```js
function stimulantInRange(entry, ranges) {
  if (!ranges || ranges.size === 0) return true;
  const stimStats = entry.strategy.stimulant?.stats;
  if (!stimStats) return true;
  for (const [statKey, { min, max }] of ranges) {
    const value = stimStats[statKey] ?? 0;
    if (value < min || value > max) return false;
  }
  return true;
}
```

- [ ] **Step 2: Run tests**

```bash
node --test tests/deconstruction-ui-contract.test.mjs
```
Expected: All pass (no stimulant ranges set yet, so all strategies pass the range check)

- [ ] **Step 3: Commit**

```bash
git add src/lib/deconstruction/resultFilters.mjs
git commit -m "feat: add stimulant stat range filtering to visible strategy computation

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Rewrite resultFilterController with source-specific renderers

**Files:**
- Modify: `src/lib/deconstruction/resultFilterController.mjs`

This is the core task. Read the current file first, then restructure it.

- [ ] **Step 1: Add imports at the top of the file**

```js
import {
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getFacetOptions,
  getVisibleStrategyIndexes,
} from './resultFilters.mjs';
import { buildItemIconUrl } from '../maplestoryIo.mjs';
import { GEM_GRADES, GEM_ITEM_IDS, HP_MP_KEYS, statLabelByKey } from '../makerData.mjs';
```

- [ ] **Step 2: Add stimulant range state and helper**

Inside `createResultFilterController`, after `let selections = new Map();`, add:

```js
let stimulantRanges = new Map(); // Map<statKey, {min: number, max: number}>
```

- [ ] **Step 3: Add source-specific render functions before `renderPanel`**

Replace the entire `renderPanel` body. First, add three helper renderers:

```js
const renderScrollPanel = (options, selected) => {
  secondaryContainer.replaceChildren();
  const list = document.createElement('div');
  list.className = 'decon-secondary-scroll-list';

  for (const option of options) {
    const label = document.createElement('label');
    label.className = 'decon-secondary-scroll-row';
    label.classList.toggle('decon-secondary-scroll-row--unavailable', !option.available);

    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = selected.has(option.key);
    input.disabled = !option.available;
    input.addEventListener('change', () => {
      setSecondaryOption('scrolls', option.key, input.checked);
    });

    const icon = document.createElement('img');
    icon.className = 'decon-secondary-scroll-icon';
    icon.src = buildItemIconUrl(option.iconId);
    icon.alt = option.label;
    icon.loading = 'lazy';
    icon.addEventListener('error', () => { icon.hidden = true; });

    const text = document.createElement('span');
    text.textContent = option.label;

    label.append(input, icon, text);
    list.append(label);
  }

  secondaryContainer.append(list);
  secondaryContainer.hidden = false;
};

const renderGemPanel = (options, selected) => {
  // Group options by gemKey
  const categories = new Map();
  for (const option of options) {
    const gemKey = option.gemKey;
    if (!categories.has(gemKey)) {
      categories.set(gemKey, {
        gemKey,
        nameKo: option.label.replace(/\s(상급|중급|하급)$/, ''),
        iconId: GEM_ITEM_IDS[gemKey]?.base ?? 0,
        grades: [],
      });
    }
    categories.get(gemKey).grades.push(option);
  }

  const showCategories = () => {
    secondaryContainer.replaceChildren();
    const label = document.createElement('div');
    label.className = 'decon-secondary-gem-label';
    label.textContent = '보석 종류 선택';
    secondaryContainer.append(label);

    const grid = document.createElement('div');
    grid.className = 'decon-secondary-gem-grid';

    for (const cat of categories.values()) {
      const item = document.createElement('div');
      item.className = 'decon-secondary-gem-category';

      const icon = document.createElement('img');
      icon.src = buildItemIconUrl(cat.iconId);
      icon.alt = cat.nameKo;
      icon.loading = 'lazy';
      icon.addEventListener('error', () => { icon.hidden = true; });

      const name = document.createElement('span');
      name.textContent = cat.nameKo;

      item.append(icon, name);
      item.addEventListener('click', () => showGrades(cat));
      grid.append(item);
    }

    secondaryContainer.append(grid);
  };

  const showGrades = (cat) => {
    secondaryContainer.replaceChildren();

    const header = document.createElement('div');
    header.className = 'decon-secondary-gem-header';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'decon-secondary-gem-back';
    backBtn.textContent = '← 뒤로';
    backBtn.addEventListener('click', showCategories);

    const icon = document.createElement('img');
    icon.src = buildItemIconUrl(cat.iconId);
    icon.alt = cat.nameKo;
    icon.loading = 'lazy';
    icon.addEventListener('error', () => { icon.hidden = true; });

    const name = document.createElement('span');
    name.className = 'decon-secondary-gem-name';
    name.textContent = cat.nameKo;

    header.append(backBtn, icon, name);

    const gradeList = document.createElement('div');
    gradeList.className = 'decon-secondary-gem-grades';

    for (const gradeOpt of cat.grades) {
      const gradeLabel = document.createElement('label');
      gradeLabel.className = 'decon-secondary-gem-grade';
      if (!gradeOpt.available) {
        gradeLabel.classList.add('decon-secondary-gem-grade--unavailable');
      }

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(gradeOpt.key);
      input.disabled = !gradeOpt.available;
      input.addEventListener('change', () => {
        setSecondaryOption('gems', gradeOpt.key, input.checked);
      });

      const gradeIcon = document.createElement('img');
      const gradeKey = gradeOpt.gradeIndex === 0 ? 'low' : gradeOpt.gradeIndex === 1 ? 'mid' : 'high';
      const gradeIconId = GEM_ITEM_IDS[cat.gemKey]?.[gradeKey] ?? 0;
      gradeIcon.src = buildItemIconUrl(gradeIconId);
      gradeIcon.alt = GEM_GRADES[gradeOpt.gradeIndex] ?? '';
      gradeIcon.loading = 'lazy';
      gradeIcon.addEventListener('error', () => { gradeIcon.hidden = true; });

      const gradeText = document.createElement('span');
      gradeText.textContent = GEM_GRADES[gradeOpt.gradeIndex] ?? '';

      gradeLabel.append(input, gradeIcon, gradeText);
      gradeList.append(gradeLabel);
    }

    secondaryContainer.append(header, gradeList);
  };

  showCategories();
};

const renderStimulantPanel = (options) => {
  secondaryContainer.replaceChildren();

  // Collect unique stat keys and their full ranges
  const statRange = new Map(); // statKey -> {min, max}
  for (const option of options) {
    if (option.key === 'stimulant:none') continue;
    // Parse stats from option label like "STR +3, DEX +1"
    const parts = option.label.split(', ');
    for (const part of parts) {
      const match = part.match(/^([A-Za-z]+)\s+([+-]?\d+)$/);
      if (match) {
        const key = match[1];
        const value = Number(match[2]);
        if (!statRange.has(key)) {
          statRange.set(key, { min: value, max: value });
        } else {
          const r = statRange.get(key);
          r.min = Math.min(r.min, value);
          r.max = Math.max(r.max, value);
        }
      }
    }
  }

  // Fallback: if no stat combos found, use target keys from the model
  if (statRange.size === 0) {
    secondaryContainer.hidden = true;
    return;
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'decon-secondary-stimulant';

  for (const [key, fullRange] of statRange) {
    const limit = HP_MP_KEYS.has(key) ? 50 : 5;
    const absMin = Math.max(-limit, fullRange.min);
    const absMax = Math.min(limit, fullRange.max);

    // Initialize range state if not set
    if (!stimulantRanges.has(key)) {
      stimulantRanges.set(key, { min: absMin, max: absMax });
    }
    const currentRange = stimulantRanges.get(key);

    const row = document.createElement('div');
    row.className = 'decon-secondary-stimulant-row';

    const label = document.createElement('span');
    label.className = 'decon-secondary-stimulant-stat';
    label.textContent = statLabelByKey[key] ?? key;

    const minSlider = document.createElement('input');
    minSlider.type = 'range';
    minSlider.min = absMin;
    minSlider.max = absMax;
    minSlider.value = currentRange.min;
    minSlider.className = 'decon-secondary-stimulant-slider';

    const minVal = document.createElement('span');
    minVal.className = 'decon-secondary-stimulant-value';
    minVal.textContent = String(currentRange.min);

    const sep = document.createElement('span');
    sep.className = 'decon-secondary-stimulant-sep';
    sep.textContent = '–';

    const maxVal = document.createElement('span');
    maxVal.className = 'decon-secondary-stimulant-value';
    maxVal.textContent = String(currentRange.max);

    const maxSlider = document.createElement('input');
    maxSlider.type = 'range';
    maxSlider.min = absMin;
    maxSlider.max = absMax;
    maxSlider.value = currentRange.max;
    maxSlider.className = 'decon-secondary-stimulant-slider';

    const updateRange = () => {
      let mn = Number(minSlider.value);
      let mx = Number(maxSlider.value);
      if (mn > mx) [mn, mx] = [mx, mn];
      stimulantRanges.set(key, { min: mn, max: mx });
      minSlider.value = mn;
      maxSlider.value = mx;
      minVal.textContent = String(mn);
      maxVal.textContent = String(mx);
      applyFilters();
    };

    minSlider.addEventListener('input', updateRange);
    maxSlider.addEventListener('input', updateRange);

    row.append(label, minSlider, minVal, sep, maxVal, maxSlider);
    wrapper.append(row);
  }

  secondaryContainer.append(wrapper);
  secondaryContainer.hidden = false;
};
```

- [ ] **Step 4: Rewrite `renderPanel` to dispatch by source**

Replace the existing `renderPanel` function:

```js
const renderPanel = (source) => {
  if (!model) return;
  const options = getFacetOptions(model, selections, source);
  if (options.length === 0) {
    hidePanel();
    return;
  }
  const selected = selections.get(source) ?? new Set();

  if (source === 'scrolls') {
    renderScrollPanel(options, selected);
  } else if (source === 'gems') {
    renderGemPanel(options, selected);
  } else if (source === 'stimulant') {
    renderStimulantPanel(options);
  } else {
    // Fallback for any future source — simple checkbox list
    secondaryContainer.replaceChildren();
    const list = document.createElement('div');
    list.className = 'decon-secondary-checkboxes';
    for (const option of options) {
      const label = document.createElement('label');
      label.className = 'decon-secondary-checkbox';
      label.classList.toggle('decon-secondary-checkbox--unavailable', !option.available);
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(option.key);
      input.disabled = !option.available;
      input.addEventListener('change', () => {
        setSecondaryOption(source, option.key, input.checked);
      });
      const text = document.createElement('span');
      text.textContent = option.label;
      label.append(input, text);
      list.append(label);
    }
    secondaryContainer.append(list);
    secondaryContainer.hidden = false;
  }
};
```

- [ ] **Step 5: Update `applyFilters` to pass stimulant ranges**

Add `stimulantRanges` as a parameter:

```js
const applyFilters = () => {
  if (!model) return 0;
  const hasRanges = stimulantRanges.size > 0;
  const visibleIndexes = new Set(getVisibleStrategyIndexes(
    model, selections,
    hasRanges ? stimulantRanges : null,
  ));
  // ... rest unchanged ...
};
```

- [ ] **Step 6: Update `reset` to clear stimulant ranges**

Add `stimulantRanges = new Map();` to the `reset` function body.

- [ ] **Step 7: Run UI contract tests — expect failures**

```bash
node --test tests/deconstruction-ui-contract.test.mjs
```
Expected: Some tests will fail because they assert old DOM structure (`.decon-secondary-filter h3`, `.decon-secondary-filter-option`, card frame markup). Note the failures — we fix them in Task 4.

- [ ] **Step 8: Commit**

```bash
git add src/lib/deconstruction/resultFilterController.mjs
git commit -m "feat: rewrite secondary filter panel with source-specific renderers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: CSS — remove old styles, add new per-format styles

**Files:**
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Remove old secondary filter CSS**

Delete the following CSS blocks (approximately lines 3118–3165):
- `:global(.decon-secondary-filters)` — the grid container
- `:global(.decon-secondary-filters[hidden])`
- `:global(.decon-secondary-filter)` — the card frame
- `:global(.decon-secondary-filter h3)` — the heading
- `:global(.decon-secondary-filter-options)` — the scrollable checkbox list
- `:global(.decon-secondary-filter-option)` — checkbox label rows
- `:global(.decon-secondary-filter-option--unavailable)`

Replace them with the new styles below.

- [ ] **Step 2: Add new CSS for secondary filter container and scroll rows**

```css
:global(.decon-secondary-filters) {
  margin-bottom: 10px;
}

:global(.decon-secondary-filters[hidden]) {
  display: none;
}

:global(.decon-secondary-scroll-list) {
  display: flex;
  flex-direction: column;
  gap: 1px;
  max-height: 160px;
  overflow-y: auto;
  scrollbar-gutter: stable;
}

:global(.decon-secondary-scroll-row) {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 3px 4px;
  font-size: 0.74rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background 0.15s ease;
}

:global(.decon-secondary-scroll-row:hover) {
  background: color-mix(in srgb, var(--line) 30%, transparent);
}

:global(.decon-secondary-scroll-row--unavailable) {
  opacity: 0.4;
  cursor: not-allowed;
}

:global(.decon-secondary-scroll-row input[type="checkbox"]) {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

:global(.decon-secondary-scroll-icon) {
  width: 20px;
  height: 20px;
  border-radius: 2px;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Add CSS for gem category grid and grade pills**

```css
:global(.decon-secondary-gem-label) {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--muted);
  margin-bottom: 4px;
}

:global(.decon-secondary-gem-grid) {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
  gap: 4px;
}

:global(.decon-secondary-gem-category) {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 7px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 0.72rem;
  cursor: pointer;
  background: var(--panel);
  transition: background 0.15s ease;
}

:global(.decon-secondary-gem-category:hover) {
  background: color-mix(in srgb, var(--line) 30%, var(--panel));
}

:global(.decon-secondary-gem-category img) {
  width: 22px;
  height: 22px;
  border-radius: 3px;
}

:global(.decon-secondary-gem-header) {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
  font-size: 0.72rem;
}

:global(.decon-secondary-gem-back) {
  background: none;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 0.7rem;
  color: var(--ink);
}

:global(.decon-secondary-gem-back:hover) {
  background: var(--line);
}

:global(.decon-secondary-gem-name) {
  font-weight: 600;
}

:global(.decon-secondary-gem-header img) {
  width: 20px;
  height: 20px;
  border-radius: 3px;
}

:global(.decon-secondary-gem-grades) {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

:global(.decon-secondary-gem-grade) {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 9px;
  border: 1px solid var(--line);
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.72rem;
  background: var(--panel);
  transition: background 0.15s ease;
}

:global(.decon-secondary-gem-grade:hover) {
  background: color-mix(in srgb, var(--line) 30%, var(--panel));
}

:global(.decon-secondary-gem-grade--unavailable) {
  opacity: 0.4;
  cursor: not-allowed;
}

:global(.decon-secondary-gem-grade input[type="checkbox"]) {
  width: 13px;
  height: 13px;
}

:global(.decon-secondary-gem-grade img) {
  width: 22px;
  height: 22px;
  border-radius: 3px;
}
```

- [ ] **Step 4: Add CSS for stimulant range sliders**

```css
:global(.decon-secondary-stimulant) {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

:global(.decon-secondary-stimulant-row) {
  display: flex;
  align-items: center;
  gap: 5px;
  background: color-mix(in srgb, var(--panel) 95%, var(--line));
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
}

:global(.decon-secondary-stimulant-stat) {
  font-weight: 600;
  min-width: 28px;
  font-size: 0.75rem;
}

:global(.decon-secondary-stimulant-slider) {
  width: 55px;
  height: 3px;
  accent-color: var(--muted);
  cursor: pointer;
}

:global(.decon-secondary-stimulant-value) {
  min-width: 14px;
  text-align: center;
  font-weight: 600;
  font-size: 0.75rem;
}

:global(.decon-secondary-stimulant-sep) {
  color: var(--muted);
}

:global(.decon-secondary-checkboxes) {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

:global(.decon-secondary-checkbox) {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 0.74rem;
  cursor: pointer;
}

:global(.decon-secondary-checkbox--unavailable) {
  opacity: 0.4;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Run UI contract tests**

```bash
node --test tests/deconstruction-ui-contract.test.mjs
```
Expected: Still some failures from the controller changes (old DOM structure assertions). We fix them next.

- [ ] **Step 6: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "style: replace secondary filter card-frame CSS with per-format styles

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Update UI contract tests

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Identify and update failing assertions**

Run `node --test tests/deconstruction-ui-contract.test.mjs` and note which tests fail.

Expected failures and their fixes:

**Test referencing `decon-secondary-filter h3`** — Remove or update:
```js
// OLD (remove/update):
assert.match(source, /decon-secondary-filter h3/);
// NEW:
assert.doesNotMatch(source, /decon-secondary-filter h3/);
```

**Test referencing `.decon-secondary-filter-option`** — Update to new selectors:
```js
// OLD:
assert.match(source, /decon-secondary-filter-option/);
// NEW:
assert.match(source, /decon-secondary-scroll-row/);
assert.match(source, /decon-secondary-gem-grade/);
assert.match(source, /decon-secondary-stimulant-row/);
```

**Test referencing card-frame `.decon-secondary-filter`** — Update:
```js
// OLD:
assert.match(source, /decon-secondary-filter[^-]/);
// NEW (negative):
assert.doesNotMatch(source, /decon-secondary-filter[^-]/);
```

- [ ] **Step 2: Run UI contract tests until all pass**

```bash
node --test tests/deconstruction-ui-contract.test.mjs
```
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add tests/deconstruction-ui-contract.test.mjs
git commit -m "test: update UI contract for new per-source secondary filter formats

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Full test suite verification

- [ ] **Step 1: Run all deconstruction tests**

```bash
node --test tests/deconstruction-engine.test.mjs tests/deconstruction-source-contributions.test.mjs tests/deconstruction-ui-contract.test.mjs
```

Expected: All pass.

- [ ] **Step 2: Fix any remaining failures, commit if needed**

```bash
git add -A
git commit -m "test: final test adjustments for secondary filter redesign

Co-Authored-By: Claude <noreply@anthropic.com>"
```
