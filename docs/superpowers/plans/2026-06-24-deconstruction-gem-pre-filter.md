# Deconstruction Gem Pre-Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gem pre-filter accordion to the "보석" source checkbox so users can narrow strategy searches to specific gem+grade combinations.

**Architecture:** A `deconGemFilter` Set (or null) tracks selected `"gemKey:gradeIndex"` entries. A `buildGemPreFilter()` inline builder function renders a two-level drill-down UI (categories → grades) with checkboxes. The filter is plumbed through `engine.mjs` → `sourceContributions.mjs` → `buildGemOutcomeOptions` to exclude unchecked combos from the strategy search.

**Tech Stack:** Astro `.astro` SFC (HTML + vanilla JS + scoped CSS), vanilla JS modules

---

### Task 1: Add gemFilter parameter through the engine layer

**Files:**
- Modify: `src/lib/deconstruction/sourceContributions.mjs:161-212`
- Modify: `src/lib/deconstruction/engine.mjs:334-350, 431-442`

- [ ] **Step 1: Add `gemFilter` to `buildGemOutcomeOptions` in sourceContributions.mjs**

Read lines 161-165. Change the function signature and add the filter check:

```js
function buildGemOutcomeOptions({ equipmentKind, cleanStats, targetKeys, gemFilter = null }) {
  const options = [];
  for (const gem of GEM_TYPES) {
    if (gem.weaponOnly && !isWeaponKind(equipmentKind)) continue;
    for (let gradeIndex = 0; gradeIndex < GEM_GRADES.length; gradeIndex++) {
      // Pre-filter: skip this gem+grade if not in the whitelist
      if (gemFilter && !gemFilter.has(`${gem.key}:${gradeIndex}`)) continue;
      if (isFixedGem(gem.key)) {
        const stats = projectVector(getFixedGemStats(gem.key, gradeIndex), targetKeys);
        // Skip gems that contribute nothing to any checked target key
        if (Object.values(stats).every((v) => v === 0)) continue;
        options.push({
          gemKey: gem.key,
          nameKo: gem.nameKo,
          gradeIndex,
          stats,
        });
        continue;
      }
      // ... rest of variable gem handling unchanged ...
```

The only changes are:
- Parameter destructuring: add `gemFilter = null`
- After the gradeIndex loop starts, before the fixed-gem check: add the `if (gemFilter && !gemFilter.has(...)) continue;` line

- [ ] **Step 2: Thread `gemFilter` through `enumerateGemContributions` in sourceContributions.mjs**

Read line 206. Change the function signature and the `buildGemOutcomeOptions` call:

```js
export function enumerateGemContributions({
  gemSlotCount,
  equipmentKind,
  cleanStats,
  targetKeys,
  bounds,
  gemFilter = null,
}) {
  if (!Number.isInteger(gemSlotCount) || gemSlotCount <= 0) return [];
  const options = buildGemOutcomeOptions({ equipmentKind, cleanStats, targetKeys, gemFilter });
  // ... rest unchanged ...
```

- [ ] **Step 3: Add `gemFilter` to `enumerateStrategies` in engine.mjs**

Read line 334. Add `gemFilter = null` to the destructured parameters:

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
  scrollRateFilter = null,
  stimulantStatBounds = null,
  levelUpSlotStatRanges = null,
  levelUpExactLevelCount = null,
  levelUpTotalStatRanges = null,
  appliedLevelStats: appliedLevelStatsRaw = null,
  gemFilter = null,
}) {
```

- [ ] **Step 4: Pass `gemFilter` to `enumerateGemContributions` in engine.mjs**

Read lines 434-442. Add `gemFilter` to the call:

```js
  const gemContributions = normalizedAllowedSources.gems
    ? enumerateGemContributions({
        gemSlotCount,
        equipmentKind,
        cleanStats,
        targetKeys,
        bounds: gemBounds,
        gemFilter,
      })
    : [];
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/deconstruction/sourceContributions.mjs src/lib/deconstruction/engine.mjs
git commit -m "feat: add gemFilter parameter to engine layer"
```

---

### Task 2: Add gem picker CSS to deconstruction.astro

**Files:**
- Modify: `src/pages/deconstruction.astro` — scoped `<style>` block

- [ ] **Step 1: Add gem picker styles**

Insert into the style block after the existing deconstruction styles. Find a good insertion point near the existing gem-related styles (around line 3242). Insert:

```css
/* Gem pre-filter picker */
.decon-gem-picker-label {
  color: var(--muted);
  font-size: 0.8rem;
  font-weight: 600;
  margin-bottom: 4px;
}

.decon-gem-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 4px;
}

.decon-gem-category {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 8px 6px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--panel);
  cursor: pointer;
  font-size: 0.74rem;
  font-weight: 600;
  color: var(--ink);
  transition: background 0.15s ease, border-color 0.15s ease;
}

.decon-gem-category:hover {
  background: color-mix(in srgb, var(--line) 30%, var(--panel));
  border-color: var(--green);
}

.decon-gem-category img {
  width: 24px;
  height: 24px;
  object-fit: contain;
  image-rendering: pixelated;
  border-radius: 2px;
}

.decon-gem-picker-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.decon-gem-picker-header img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  image-rendering: pixelated;
  border-radius: 2px;
}

.decon-gem-name {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--ink);
}

.decon-gem-back {
  background: none;
  border: 1px solid var(--line);
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 0.7rem;
  color: var(--ink);
  font-family: inherit;
}

.decon-gem-back:hover {
  background: var(--line);
}

.decon-gem-grades {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.decon-gem-grade {
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

.decon-gem-grade:hover {
  background: color-mix(in srgb, var(--line) 30%, var(--panel));
}

.decon-gem-grade input[type="checkbox"] {
  width: 13px;
  height: 13px;
  flex-shrink: 0;
}

.decon-gem-grade img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  image-rendering: pixelated;
  border-radius: 3px;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "style: add gem pre-filter picker CSS classes"
```

---

### Task 3: Add buildGemPreFilter builder and wire into toggleSourceSub

**Files:**
- Modify: `src/pages/deconstruction.astro` — `<script>` block

- [ ] **Step 0: Add missing imports from makerData**

Read line 343. Change:

```js
import { GEM_GRADES } from '../lib/makerData.mjs';
```

To:

```js
import { GEM_GRADES, GEM_ITEM_IDS, GEM_TYPES } from '../lib/makerData.mjs';
```

- [ ] **Step 1: Add `deconGemFilter` state variable and DOM ref for the sub-container**

Find `let deconStimulantBoundsMap = {};` (around line 464). After it, add:

```js
let deconGemFilter = null; // null = all gems available
```

Find the DOM refs section (around line 403). The gem source sub-container `<div class="decon-source-sub">` needs a `data-` attribute. First, update the HTML template so the gem sub-container has a data attribute for querying. Read lines 269-274:

```html
                <div class="decon-source-row">
                  <label class="ev-target-chip">
                    <input type="checkbox" data-decon-source="gems" />
                    <span class="ev-target-chip-label">보석</span>
                  </label>
                  <div class="decon-source-sub"></div>
                </div>
```

Change the empty `<div class="decon-source-sub"></div>` to:

```html
                  <div class="decon-source-sub" data-decon-gem-sub></div>
```

Then in the DOM refs section (after the existing `deconGemsSource` ref at line ~421), add:

```js
const deconGemSub = document.querySelector('[data-decon-gem-sub]');
```

- [ ] **Step 2: Add the `buildGemPreFilter` function**

Insert after `buildStimulantBoundsEditor` (after line ~1047). Place it before `buildLevelUpSlotEditors`. Insert:

```js
const buildGemPreFilter = () => {
  if (!(deconGemSub instanceof HTMLElement)) return;
  if (!selectedItem) return;

  const equipmentKind = selectedItem.equipmentKind;

  // Initialize filter with all gems/grades if null
  if (deconGemFilter === null) {
    deconGemFilter = new Set();
    for (const gem of GEM_TYPES) {
      if (gem.weaponOnly && equipmentKind !== 'weapon') continue;
      for (let gi = 0; gi < GEM_GRADES.length; gi++) {
        deconGemFilter.add(`${gem.key}:${gi}`);
      }
    }
  }

  const renderCategories = () => {
    deconGemSub.replaceChildren();

    const label = document.createElement('p');
    label.className = 'decon-gem-picker-label';
    label.textContent = '보석 종류 선택';
    deconGemSub.append(label);

    const grid = document.createElement('div');
    grid.className = 'decon-gem-grid';

    for (const gem of GEM_TYPES) {
      if (gem.weaponOnly && equipmentKind !== 'weapon') continue;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'decon-gem-category';

      const baseId = GEM_ITEM_IDS[gem.key]?.base;
      if (baseId) {
        const icon = document.createElement('img');
        icon.src = buildItemIconUrl(baseId);
        icon.alt = '';
        icon.loading = 'lazy';
        card.append(icon);
      }

      const name = document.createElement('span');
      name.textContent = gem.nameKo;
      card.append(name);

      card.addEventListener('click', () => renderGrades(gem));
      grid.append(card);
    }

    deconGemSub.append(grid);
  };

  const renderGrades = (gem) => {
    deconGemSub.replaceChildren();

    const header = document.createElement('div');
    header.className = 'decon-gem-picker-header';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'decon-gem-back';
    backBtn.textContent = '← 뒤로';
    backBtn.addEventListener('click', renderCategories);
    header.append(backBtn);

    const baseId = GEM_ITEM_IDS[gem.key]?.base;
    if (baseId) {
      const icon = document.createElement('img');
      icon.src = buildItemIconUrl(baseId);
      icon.alt = '';
      icon.loading = 'lazy';
      header.append(icon);
    }

    const nameEl = document.createElement('span');
    nameEl.className = 'decon-gem-name';
    nameEl.textContent = gem.nameKo;
    header.append(nameEl);

    deconGemSub.append(header);

    const gradesList = document.createElement('div');
    gradesList.className = 'decon-gem-grades';

    for (let gradeIndex = 0; gradeIndex < GEM_GRADES.length; gradeIndex++) {
      const gradeLabel = GEM_GRADES[gradeIndex];

      const row = document.createElement('label');
      row.className = 'decon-gem-grade';

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      const filterKey = `${gem.key}:${gradeIndex}`;
      checkbox.checked = deconGemFilter?.has(filterKey) ?? true;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          deconGemFilter.add(filterKey);
        } else {
          deconGemFilter.delete(filterKey);
        }
      });
      row.append(checkbox);

      const gradeKey = ['low', 'mid', 'high'][gradeIndex];
      const gradeIconId = GEM_ITEM_IDS[gem.key]?.[gradeKey];
      if (gradeIconId) {
        const gradeIcon = document.createElement('img');
        gradeIcon.src = buildItemIconUrl(gradeIconId);
        gradeIcon.alt = '';
        gradeIcon.loading = 'lazy';
        row.append(gradeIcon);
      }

      const text = document.createElement('span');
      if (gem.stat && gem.values) {
        const val = gem.values[gradeIndex];
        const statLabel = statLabelByKey[gem.stat] || gem.stat;
        text.textContent = `${gradeLabel} ${statLabel} +${val}`;
      } else {
        text.textContent = gradeLabel;
      }
      row.append(text);

      gradesList.append(row);
    }

    deconGemSub.append(gradesList);
  };

  renderCategories();
};
```

- [ ] **Step 3: Wire `gemPreFilter` into the gem source checkbox change handler**

Find the gem source change handler (around line 546). Replace:

```js
deconGemsSource?.addEventListener('change', () => {
  updateAnalyzeButton();
});
```

With:

```js
deconGemsSource?.addEventListener('change', () => {
  toggleSourceSub(deconGemsSource, deconGemSub, () => {
    deconGemFilter = null;
    buildGemPreFilter();
  });
  if (!deconGemsSource.checked) {
    deconGemFilter = null;
  }
  updateAnalyzeButton();
});
```

- [ ] **Step 4: Build and verify no syntax errors**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: add buildGemPreFilter and wire into gem source accordion"
```

---

### Task 4: Wire deconGemFilter into runAnalysis

**Files:**
- Modify: `src/pages/deconstruction.astro` — `runAnalysis` function

- [ ] **Step 1: Pass `gemFilter` to `enumerateStrategies`**

Find the `enumerateStrategies` call in `runAnalysis` (around line 1537). Add the `gemFilter` parameter. The current call looks like:

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
    levelUpDefinition: levelUpDef ?? null,
    scrollRateFilter: deconScrollRateFilter.size > 0 ? deconScrollRateFilter : null,
    stimulantStatBounds: Object.keys(deconStimulantBoundsMap).length > 0 ? deconStimulantBoundsMap : null,
    levelUpExactLevelCount: appliedCount,
    levelUpTotalStatRanges: appliedCount > 0 && Object.keys(deconLevelUpTotalRanges).length > 0
      ? deconLevelUpTotalRanges
      : null,
  });
```

Insert the `gemFilter` line after `stimulantStatBounds`:

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
    levelUpDefinition: levelUpDef ?? null,
    scrollRateFilter: deconScrollRateFilter.size > 0 ? deconScrollRateFilter : null,
    stimulantStatBounds: Object.keys(deconStimulantBoundsMap).length > 0 ? deconStimulantBoundsMap : null,
    gemFilter: deconGemFilter,
    levelUpExactLevelCount: appliedCount,
    levelUpTotalStatRanges: appliedCount > 0 && Object.keys(deconLevelUpTotalRanges).length > 0
      ? deconLevelUpTotalRanges
      : null,
  });
```

- [ ] **Step 2: Also wire into the initial filter set on item change**

Find `clearDeconCalculationState` (around line 1240). After the line `deconStimulantBoundsMap = {};`, add:

```js
  deconGemFilter = null;
```

- [ ] **Step 3: Reset deconGemFilter in the reset button handler**

Find the reset handler (around line 2055). After `deconStimulantBoundsMap = {};` is already reset in `clearDeconCalculationState`. The `activateDeconEditPanel` call will trigger `buildGemPreFilter` when the accordion re-opens. No extra change needed — the `deconGemFilter = null` in Step 2 covers this.

- [ ] **Step 4: Build and verify**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: wire gemFilter into runAnalysis and state lifecycle"
```

---

### Task 5: Verify

**Files:** none (manual verification)

- [ ] **Step 1: Build the project**

```bash
cd /Users/andykim/Desktop/project/ScrollBluePill && npm run build
```

Expected: Build succeeds with no errors, 11 pages built.

- [ ] **Step 2: Start dev server and visually verify**

```bash
npm run dev
```

Open the deconstruction page in a browser and:

1. Select an item with gem slots (required level ≥ 48)
2. Scroll to Section 3 (계산), check "보석" → verify accordion opens showing gem categories
3. Verify weapon-only gems are hidden for armor items, visible for weapons
4. Click a gem category → verify grade view shows all 3 grades with checkboxes (all checked)
5. Uncheck a grade → verify checkbox state changes, stays on grade view
6. Click "← 뒤로" → verify returns to category view
7. Uncheck some gems/grades → run analysis → verify strategies only use checked gem combos
8. Uncheck "보석" source → verify accordion closes. Re-check → verify accordion reopens with previous selections preserved
9. Select a new item → verify filter resets
10. Test with a weapon item → verify darkCrystal, blackAmethyst appear (weapon-only gems)

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add src/pages/deconstruction.astro
git commit -m "fix: adjustments from visual verification"
```
