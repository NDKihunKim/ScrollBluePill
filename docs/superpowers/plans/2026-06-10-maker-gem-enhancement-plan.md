# Maker Gem Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Maker gem enhancement panel below the scroll list, allowing users to slot 1–3 gems (by item level) that stack with scroll stats.

**Architecture:** Three new modules: `makerData.mjs` (gem definitions, stat priority), `enhancementState.mjs` (wrapper around `scrollState` that adds gemSlots + combined stat/grade computation), `makerPanel.mjs` (UI rendering for gem slots and two-step picker). Existing `enhancementPanel.mjs` switches from raw `scrollState` to `enhancementState` for stat computation; `index.astro` gets a new HTML container for the Maker section.

**Tech Stack:** Vanilla JS (ES modules), Astro 6, no framework

---

### Task 1: Create `makerData.mjs` — gem definitions and stat priority

**Files:**
- Create: `src/lib/makerData.mjs`

- [ ] **Step 1: Write the module**

```js
import { weaponKinds } from './calculatorInput.mjs';

export const GEM_GRADES = ['하급', '중급', '상급'];

export const STAT_KEY_RANK = {
  weaponAttack: 0,
  magicAttack: 1,
  str: 2,
  dex: 3,
  int: 4,
  luk: 5,
  accuracy: 6,
  avoidability: 7,
  speed: 8,
  jump: 9,
  maxHp: 10,
  maxMp: 11,
};

export const statLabelByKey = {
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  maxHp: 'MaxHP',
  maxMp: 'MaxMP',
  weaponAttack: '공격력',
  magicAttack: '마력',
  weaponDefense: '물리방어력',
  magicDefense: '마법방어력',
  accuracy: '명중률',
  avoidability: '회피율',
  speed: '이동속도',
  jump: '점프력',
};

export const GEM_TYPES = [
  { key: 'diamond',     nameKo: '다이아몬드',       stat: 'weaponAttack',   weaponOnly: true,  values: [1, 2, 3] },
  { key: 'sapphire',    nameKo: '사파이어',         stat: 'magicAttack',    weaponOnly: true,  values: [1, 2, 3] },
  { key: 'strCrystal',  nameKo: '힘의 크리스탈',    stat: 'str',            weaponOnly: false, values: [1, 3, 5] },
  { key: 'dexCrystal',  nameKo: '민첩의 크리스탈',  stat: 'dex',            weaponOnly: false, values: [1, 3, 5] },
  { key: 'intCrystal',  nameKo: '지혜의 크리스탈',  stat: 'int',            weaponOnly: false, values: [1, 3, 5] },
  { key: 'lukCrystal',  nameKo: '행운의 크리스탈',  stat: 'luk',            weaponOnly: false, values: [1, 3, 5] },
  { key: 'garnet',      nameKo: '가넷',             stat: 'accuracy',       weaponOnly: false, values: [2, 3, 5] },
  { key: 'opal',        nameKo: '오팔',             stat: 'avoidability',   weaponOnly: false, values: [2, 3, 5] },
  { key: 'amethyst',    nameKo: '자수정',           stat: 'speed',          weaponOnly: false, values: [2, 3, 5] },
  { key: 'aquamarine',  nameKo: '아쿠아마린',       stat: 'jump',           weaponOnly: false, values: [1, 3, 5] },
  { key: 'topaz',       nameKo: '토파즈',           stat: 'maxHp',          weaponOnly: false, values: [10, 20, 30] },
  { key: 'emerald',     nameKo: '에메랄드',         stat: 'maxMp',          weaponOnly: false, values: [10, 20, 30] },
];

export function computeGemSlotCount(requiredLevel) {
  const level = Number.isFinite(requiredLevel) ? requiredLevel : 0;
  if (level < 48) return 0;
  if (level <= 77) return 1;
  if (level <= 105) return 2;
  return 3;
}

export function isWeaponKind(equipmentKind) {
  return weaponKinds.includes(equipmentKind);
}

export function getVisibleGemTypes(equipmentKind, usedGemKeys) {
  const isWeapon = isWeaponKind(equipmentKind);
  const used = new Set(usedGemKeys);

  return GEM_TYPES.filter((gem) => {
    if (gem.weaponOnly && !isWeapon) return false;
    return true;
  }).map((gem) => ({
    ...gem,
    disabled: used.has(gem.key),
  }));
}

export function getGemTypeByKey(key) {
  return GEM_TYPES.find((g) => g.key === key) ?? null;
}

export function getGemStatPriority(gemKey) {
  const gem = getGemTypeByKey(gemKey);
  if (!gem) return 99;
  return STAT_KEY_RANK[gem.stat] ?? 99;
}

/**
 * MapleStory item IDs for gem icons.
 * Mid-grade (중급) IDs are used for step 1 picker representations.
 * Individual grade IDs used for step 2 pickers and filled slots.
 * IDs of 0 act as fallback — icon will show as broken image until
 * actual IDs are sourced from MapleStory game data.
 */
export const GEM_ITEM_IDS = {
  diamond:     { low: 0, mid: 0, high: 0 },
  sapphire:    { low: 0, mid: 0, high: 0 },
  strCrystal:  { low: 0, mid: 0, high: 0 },
  dexCrystal:  { low: 0, mid: 0, high: 0 },
  intCrystal:  { low: 0, mid: 0, high: 0 },
  lukCrystal:  { low: 0, mid: 0, high: 0 },
  garnet:      { low: 0, mid: 0, high: 0 },
  opal:        { low: 0, mid: 0, high: 0 },
  amethyst:    { low: 0, mid: 0, high: 0 },
  aquamarine:  { low: 0, mid: 0, high: 0 },
  topaz:       { low: 0, mid: 0, high: 0 },
  emerald:     { low: 0, mid: 0, high: 0 },
};
```

- [ ] **Step 2: Verify the module loads without syntax errors**

Run: `node --input-type=module -e "import { GEM_TYPES, computeGemSlotCount, getVisibleGemTypes, getGemStatPriority } from './src/lib/makerData.mjs'; console.log('GEM_TYPES:', GEM_TYPES.length); console.log('slotCount lvl 50:', computeGemSlotCount(50)); console.log('slotCount lvl 80:', computeGemSlotCount(80)); console.log('slotCount lvl 110:', computeGemSlotCount(110)); console.log('slotCount lvl 30:', computeGemSlotCount(30)); console.log('visible for 한손검:', getVisibleGemTypes('한손검', []).length); console.log('visible for 모자:', getVisibleGemTypes('모자', []).length);"`

Expected: `GEM_TYPES: 12`, `slotCount lvl 50: 1`, `slotCount lvl 80: 2`, `slotCount lvl 110: 3`, `slotCount lvl 30: 0`, `visible for 한손검: 12`, `visible for 모자: 10`

- [ ] **Step 3: Commit**

```bash
git add src/lib/makerData.mjs
git commit -m "feat: add makerData with gem definitions and stat priority

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create `enhancementState.mjs` — state wrapper with gem slots

**Files:**
- Create: `src/lib/enhancementState.mjs`

- [ ] **Step 1: Write the module**

```js
import {
  createScrollState,
  applyScroll,
  revertToSlot,
  resetState,
  computeAppliedScrollCount as _scrollAppliedCount,
  computeRemainingSlots as _scrollRemainingSlots,
} from './scrollState.mjs';
import { computeGemSlotCount } from './makerData.mjs';

const HP_MP_KEYS = new Set(['maxHp', 'maxMp']);

export function createEnhancementState(upgradeSlots, requiredLevel) {
  const scrollState = createScrollState(upgradeSlots);
  const gemSlotCount = computeGemSlotCount(requiredLevel);
  const gemSlots = new Array(gemSlotCount).fill(null);
  const makerActive = false;

  return { scrollState, gemSlots, gemSlotCount, makerActive };
}

export function activateMaker(state) {
  state.makerActive = true;
}

export function deactivateMaker(state) {
  state.makerActive = false;
  for (let i = 0; i < state.gemSlots.length; i++) {
    state.gemSlots[i] = null;
  }
}

export function applyGem(state, slotIndex, gemKey, gradeIndex) {
  if (slotIndex < 0 || slotIndex >= state.gemSlotCount) {
    return false;
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    if (i !== slotIndex && state.gemSlots[i]?.gemKey === gemKey) {
      return false;
    }
  }

  state.gemSlots[slotIndex] = { gemKey, gradeIndex };
  return true;
}

export function revertGemSlot(state, slotIndex) {
  if (slotIndex < 0 || slotIndex >= state.gemSlotCount) {
    return;
  }
  state.gemSlots[slotIndex] = null;
}

export function resetGems(state) {
  for (let i = 0; i < state.gemSlots.length; i++) {
    state.gemSlots[i] = null;
  }
}

export function isGemSlotAvailable(state, gemKey) {
  for (let i = 0; i < state.gemSlots.length; i++) {
    if (state.gemSlots[i]?.gemKey === gemKey) {
      return false;
    }
  }
  return true;
}

export function computeAccumulatedStats(baseStats, state) {
  const accumulated = {};

  if (baseStats) {
    for (const [key, value] of Object.entries(baseStats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = value;
      }
    }
  }

  const { scrollState } = state;

  for (let i = 0; i < scrollState.slotCount; i++) {
    const scroll = scrollState.slots[i];
    if (!scroll?.stats) continue;

    for (const [key, value] of Object.entries(scroll.stats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = (accumulated[key] ?? 0) + value;
      }
    }
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    const gemSlot = state.gemSlots[i];
    if (!gemSlot) continue;

    const { getGemTypeByKey } = requireActualGemType(gemSlot.gemKey);
    if (!getGemTypeByKey) continue;

    const statKey = getGemTypeByKey(gemSlot.gemKey)?.stat;
    const value = getGemTypeByKey(gemSlot.gemKey)?.values[gemSlot.gradeIndex];
    if (statKey && Number.isFinite(value)) {
      accumulated[statKey] = (accumulated[statKey] ?? 0) + value;
    }
  }

  return accumulated;
}

export function computeGradeColor(state) {
  let totalAddedConstants = 0;

  const { scrollState } = state;

  for (let i = 0; i < scrollState.slotCount; i++) {
    const scroll = scrollState.slots[i];
    if (!scroll?.stats) continue;

    for (const [key, value] of Object.entries(scroll.stats)) {
      if (!Number.isFinite(value)) continue;

      if (HP_MP_KEYS.has(key)) {
        totalAddedConstants += Math.round(value / 10);
      } else {
        totalAddedConstants += value;
      }
    }
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    const gemSlot = state.gemSlots[i];
    if (!gemSlot) continue;

    const { getGemTypeByKey } = requireActualGemType(gemSlot.gemKey);
    if (!getGemTypeByKey) continue;

    const gem = getGemTypeByKey(gemSlot.gemKey);
    if (!gem) continue;

    const value = gem.values[gemSlot.gradeIndex];
    if (!Number.isFinite(value)) continue;

    if (HP_MP_KEYS.has(gem.stat)) {
      totalAddedConstants += Math.round(value / 10);
    } else {
      totalAddedConstants += value;
    }
  }

  if (totalAddedConstants < 0) return '#9e9e9e';
  if (totalAddedConstants === 0) return '#ffffff';
  if (totalAddedConstants <= 5) return '#ff8c00';
  if (totalAddedConstants <= 22) return '#3366ff';
  if (totalAddedConstants <= 39) return '#9933ff';
  if (totalAddedConstants <= 56) return '#ffd700';
  if (totalAddedConstants <= 73) return '#33cc33';
  return '#ff3333';
}

// ---- Re-export scroll helpers (delegate to inner scrollState) ----

export function applyScroll(state, scroll) {
  return applyScroll(state.scrollState, scroll);
}

export function revertToSlot(state, slotIndex) {
  revertToSlot(state.scrollState, slotIndex);
}

export function resetState(state) {
  resetState(state.scrollState);
  resetGems(state);
}

export function computeAppliedScrollCount(state) {
  return _scrollAppliedCount(state.scrollState);
}

export function computeRemainingSlots(state) {
  return _scrollRemainingSlots(state.scrollState);
}
```

- [ ] **Step 2: Realize the `computeAccumulatedStats` and `computeGradeColor` have a circular problem — they need `getGemTypeByKey` but can't import it at the top without a circular dependency. Fix: import at the top, not inline.**

Edit the file to add the import at the top and remove the inline require hacks:

The top of the file should be:

```js
import {
  createScrollState as _createScrollState,
  applyScroll as _applyScroll,
  revertToSlot as _revertToSlot,
  resetState as _resetScrollState,
  computeAppliedScrollCount as _scrollAppliedCount,
  computeRemainingSlots as _scrollRemainingSlots,
} from './scrollState.mjs';
import { computeGemSlotCount, getGemTypeByKey } from './makerData.mjs';
```

And replace the two `requireActualGemType` blocks with direct use of `getGemTypeByKey`:

In `computeAccumulatedStats`, the gem loop becomes:
```js
  for (let i = 0; i < state.gemSlots.length; i++) {
    const gemSlot = state.gemSlots[i];
    if (!gemSlot) continue;

    const gem = getGemTypeByKey(gemSlot.gemKey);
    if (!gem) continue;

    const statKey = gem.stat;
    const value = gem.values[gemSlot.gradeIndex];
    if (statKey && Number.isFinite(value)) {
      accumulated[statKey] = (accumulated[statKey] ?? 0) + value;
    }
  }
```

In `computeGradeColor`, the gem loop becomes:
```js
  for (let i = 0; i < state.gemSlots.length; i++) {
    const gemSlot = state.gemSlots[i];
    if (!gemSlot) continue;

    const gem = getGemTypeByKey(gemSlot.gemKey);
    if (!gem) continue;

    const value = gem.values[gemSlot.gradeIndex];
    if (!Number.isFinite(value)) continue;

    if (HP_MP_KEYS.has(gem.stat)) {
      totalAddedConstants += Math.round(value / 10);
    } else {
      totalAddedConstants += value;
    }
  }
```

- [ ] **Step 3: Verify the module loads without syntax errors**

Run: `node --input-type=module -e "
import { createEnhancementState, activateMaker, applyGem, computeAccumulatedStats, computeGradeColor, revertGemSlot, resetState } from './src/lib/enhancementState.mjs';

const state = createEnhancementState(7, 80);
console.log('gemSlotCount:', state.gemSlotCount);
console.log('makerActive:', state.makerActive);

activateMaker(state);
console.log('makerActive after activate:', state.makerActive);

const ok = applyGem(state, 0, 'strCrystal', 2);
console.log('applyGem ok:', ok);
console.log('gemSlots[0]:', state.gemSlots[0]);

const dup = applyGem(state, 1, 'strCrystal', 0);
console.log('duplicate blocked:', !dup);

const stats = computeAccumulatedStats({ str: 3, dex: 2 }, state);
console.log('accumulated str (3 base + 5 gem):', stats.str);
console.log('accumulated dex:', stats.dex);

const color = computeGradeColor(state);
console.log('gradeColor:', color);

resetState(state);
console.log('gem cleared after reset:', state.gemSlots[0]);
"`

Expected: `gemSlotCount: 2`, `makerActive: false`, `makerActive after activate: true`, `applyGem ok: true`, `gemSlots[0]: { gemKey: 'strCrystal', gradeIndex: 2 }`, `duplicate blocked: true`, `accumulated str: 8`, `accumulated dex: 2`, `gradeColor: #ff8c00` (5 constants = orange), `gem cleared after reset: null`

- [ ] **Step 4: Commit**

```bash
git add src/lib/enhancementState.mjs
git commit -m "feat: add enhancementState wrapper with gem slot support

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Add Maker HTML containers to `index.astro`

**Files:**
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Add the Maker section HTML below the scroll list div (after line 221, before the closing `</div>` of `enhancement-active`)**

Insert after line 221 (`</div>` closing `enhancement-scroll-section`):

```html
<div class="maker-section" data-maker-section hidden>
  <div class="maker-toggle-row">
    <button type="button" class="maker-toggle-button" data-maker-toggle disabled>
      메이커
    </button>
  </div>
  <div class="maker-gem-area" data-maker-gem-area hidden>
    <p class="enhancement-section-label">추가 재료</p>
    <div class="maker-gem-slots" data-maker-gem-slots>
    </div>
    <div class="maker-picker" data-maker-picker hidden>
      <p class="enhancement-section-label" data-maker-picker-label>보석 종류 선택</p>
      <div class="maker-picker-grid" data-maker-picker-grid>
      </div>
      <button type="button" class="small-button secondary maker-picker-back" data-maker-picker-back>
        뒤로
      </button>
    </div>
  </div>
</div>
```

- [ ] **Step 2: Add CSS styles for the Maker section at the end of the `<style>` block**

Append before the closing `</style>` tag:

```css
/* Maker gem section */
.maker-toggle-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 18px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.maker-toggle-button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.maker-toggle-button.maker-toggle-button--active {
  border-color: var(--green);
  background: var(--green);
  color: white;
}
.maker-gem-slots {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.maker-gem-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 72px;
  height: 84px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  gap: 4px;
  font-size: 0.8rem;
  text-align: center;
  position: relative;
  transition: border-color 0.15s;
}
.maker-gem-slot:hover:not(.maker-gem-slot--disabled) {
  border-color: var(--green);
}
.maker-gem-slot--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.maker-gem-slot--disabled::after {
  content: '✗';
  position: absolute;
  font-size: 1.5rem;
  color: var(--line);
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}
.maker-gem-slot--filled {
  border-color: var(--green);
}
.maker-gem-slot img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.maker-gem-slot .maker-gem-slot-name {
  font-size: 0.7rem;
  line-height: 1.15;
}
.maker-gem-slot .maker-gem-slot-grade {
  font-size: 0.7rem;
  color: var(--green);
  font-weight: 600;
}
.maker-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
.maker-picker-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px 4px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface);
  cursor: pointer;
  gap: 4px;
  font-size: 0.75rem;
  text-align: center;
  transition: border-color 0.15s;
}
.maker-picker-item:hover:not(.maker-picker-item--disabled) {
  border-color: var(--green);
}
.maker-picker-item--disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.maker-picker-item img {
  width: 28px;
  height: 28px;
  object-fit: contain;
}
.maker-picker-item .maker-picker-item-stat {
  font-size: 0.7rem;
  color: var(--muted);
}
.maker-picker-back {
  display: block;
  margin: 0 auto;
}
```

- [ ] **Step 3: Verify the page still builds**

Run: `npx astro build --root /Users/andykim/Desktop/project/ScrollBluePill/.claude/worktrees/maker-gem-design 2>&1 | tail -5`

Expected: Build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add Maker section HTML and CSS to enhancement panel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Create `makerPanel.mjs` — Maker UI rendering

**Files:**
- Create: `src/lib/makerPanel.mjs`

- [ ] **Step 1: Write the module**

```js
import { GEM_GRADES, GEM_ITEM_IDS, getVisibleGemTypes, getGemTypeByKey, statLabelByKey } from './makerData.mjs';
import { activateMaker, deactivateMaker, applyGem, revertGemSlot, computeAccumulatedStats, computeGradeColor, computeAppliedScrollCount, computeRemainingSlots } from './enhancementState.mjs';
import { buildItemIconUrl } from './maplestoryIo.mjs';

export function initMakerPanel({
  makerSection,
  makerToggle,
  makerGemArea,
  makerGemSlots,
  makerPicker,
  makerPickerLabel,
  makerPickerGrid,
  makerPickerBack,
  renderEnhancedItemCard,
}) {
  let enhancementState = null;
  let selectedBaseItem = null;
  let editingSlotIndex = -1;
  let pendingGemKey = null;

  const SLOT_COUNT = 3;

  const hidePicker = () => {
    if (makerPicker instanceof HTMLElement) {
      makerPicker.hidden = true;
    }
    pendingGemKey = null;
    editingSlotIndex = -1;
  };

  const refreshEnhancedCard = () => {
    if (!selectedBaseItem || !enhancementState) return;

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    const remaining = computeRemainingSlots(enhancementState);
    const appliedCount = computeAppliedScrollCount(enhancementState);
    const gradeColor = computeGradeColor(enhancementState);

    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor);
  };

  const renderGemSlots = () => {
    if (!(makerGemSlots instanceof HTMLElement) || !enhancementState) return;

    makerGemSlots.replaceChildren();

    for (let i = 0; i < SLOT_COUNT; i++) {
      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'maker-gem-slot';

      const isDisabled = i >= enhancementState.gemSlotCount;
      const gemSlot = i < enhancementState.gemSlots.length ? enhancementState.gemSlots[i] : null;

      if (isDisabled) {
        box.classList.add('maker-gem-slot--disabled');
      }

      if (gemSlot) {
        box.classList.add('maker-gem-slot--filled');

        const gem = getGemTypeByKey(gemSlot.gemKey);
        if (gem) {
          const gradeKey = gemSlot.gradeIndex === 2 ? 'high' : gemSlot.gradeIndex === 1 ? 'mid' : 'low';
          const iconId = GEM_ITEM_IDS[gem.key]?.[gradeKey] ?? 0;

          const img = document.createElement('img');
          img.src = buildItemIconUrl(iconId);
          img.alt = '';
          img.loading = 'lazy';

          const nameSpan = document.createElement('span');
          nameSpan.className = 'maker-gem-slot-name';
          nameSpan.textContent = gem.nameKo;

          const gradeSpan = document.createElement('span');
          gradeSpan.className = 'maker-gem-slot-grade';
          gradeSpan.textContent = GEM_GRADES[gemSlot.gradeIndex];

          box.append(img, nameSpan, gradeSpan);
        }
      }

      if (!isDisabled || gemSlot) {
        box.addEventListener('click', () => {
          if (!enhancementState || isDisabled) return;

          if (gemSlot) {
            revertGemSlot(enhancementState, i);
            renderGemSlots();
            refreshEnhancedCard();
            return;
          }

          editingSlotIndex = i;
          renderStep1Picker();
        });
      }

      makerGemSlots.append(box);
    }
  };

  const renderStep1Picker = () => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement) ||
        !enhancementState || !selectedBaseItem) {
      return;
    }

    makerPickerLabel.textContent = '보석 종류 선택';
    makerPickerGrid.replaceChildren();
    makerPicker.hidden = false;

    const usedKeys = enhancementState.gemSlots
      .filter((s) => s !== null)
      .map((s) => s.gemKey);

    const visibleGems = getVisibleGemTypes(selectedBaseItem.equipmentKind, usedKeys);

    visibleGems.forEach((gem) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'maker-picker-item';

      if (gem.disabled) {
        item.classList.add('maker-picker-item--disabled');
      }

      const img = document.createElement('img');
      const step1IconId = GEM_ITEM_IDS[gem.key]?.mid ?? 0;
      img.src = buildItemIconUrl(step1IconId);
      img.alt = '';
      img.loading = 'lazy';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = gem.nameKo;

      const statSpan = document.createElement('span');
      statSpan.className = 'maker-picker-item-stat';
      statSpan.textContent = `(${statLabelByKey[gem.stat] ?? gem.stat})`;

      item.append(img, nameSpan, statSpan);

      if (!gem.disabled) {
        item.addEventListener('click', () => {
          pendingGemKey = gem.key;
          renderStep2Picker();
        });
      }

      makerPickerGrid.append(item);
    });
  };

  const renderStep2Picker = () => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement)) {
      return;
    }

    const gem = getGemTypeByKey(pendingGemKey);
    if (!gem) return;

    makerPickerLabel.textContent = `등급 선택 — ${gem.nameKo}`;
    makerPickerGrid.replaceChildren();

    for (let gradeIndex = 2; gradeIndex >= 0; gradeIndex--) {
      const value = gem.values[gradeIndex];
      const gradeLabel = GEM_GRADES[gradeIndex];
      const statLabel = statLabelByKey[gem.stat] ?? gem.stat;

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'maker-picker-item';

      const gradeKey = gradeIndex === 2 ? 'high' : gradeIndex === 1 ? 'mid' : 'low';
      const step2IconId = GEM_ITEM_IDS[gem.key]?.[gradeKey] ?? 0;

      const img = document.createElement('img');
      img.src = buildItemIconUrl(step2IconId);
      img.alt = '';
      img.loading = 'lazy';

      const gradeSpan = document.createElement('span');
      gradeSpan.textContent = gradeLabel;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'maker-picker-item-stat';
      valueSpan.textContent = `${statLabel} +${value}`;

      item.append(img, gradeSpan, valueSpan);

      item.addEventListener('click', () => {
        if (!enhancementState || editingSlotIndex < 0) return;

        const ok = applyGem(enhancementState, editingSlotIndex, gem.key, gradeIndex);
        if (!ok) return;

        hidePicker();
        renderGemSlots();
        refreshEnhancedCard();
      });

      makerPickerGrid.append(item);
    }
  };

  const goBackToStep1 = () => {
    if (pendingGemKey) {
      renderStep1Picker();
    } else {
      hidePicker();
    }
  };

  if (makerPickerBack instanceof HTMLElement) {
    makerPickerBack.addEventListener('click', goBackToStep1);
  }

  const setupMakerToggle = () => {
    if (!(makerToggle instanceof HTMLElement) ||
        !(makerGemArea instanceof HTMLElement) ||
        !(makerSection instanceof HTMLElement)) {
      return;
    }

    const disableMaker = () => {
      if (enhancementState) {
        deactivateMaker(enhancementState);
      }
      makerToggle.classList.remove('maker-toggle-button--active');
      if (makerGemArea instanceof HTMLElement) makerGemArea.hidden = true;
      hidePicker();
      renderGemSlots();
      refreshEnhancedCard();
      makerToggle.textContent = '메이커';
    };

    const enableMaker = () => {
      if (enhancementState) {
        activateMaker(enhancementState);
      }
      makerToggle.classList.add('maker-toggle-button--active');
      if (makerGemArea instanceof HTMLElement) makerGemArea.hidden = false;
      renderGemSlots();
      makerToggle.textContent = '메이커 ✓';
    };

    makerToggle.addEventListener('click', () => {
      if (!enhancementState || makerToggle.disabled) return;

      if (enhancementState.makerActive) {
        disableMaker();
      } else {
        enableMaker();
      }
    });
  };

  setupMakerToggle();

  return {
    activate(enhState, item) {
      enhancementState = enhState;
      selectedBaseItem = item;

      if (makerSection instanceof HTMLElement) {
        makerSection.hidden = false;
      }

      const canUseMaker = enhancementState.gemSlotCount > 0;

      if (makerToggle instanceof HTMLElement) {
        makerToggle.disabled = !canUseMaker;
      }

      if (enhancementState.makerActive) {
        if (makerGemArea instanceof HTMLElement) {
          makerGemArea.hidden = false;
        }
        if (makerToggle instanceof HTMLElement) {
          makerToggle.classList.add('maker-toggle-button--active');
          makerToggle.textContent = '메이커 ✓';
        }
        renderGemSlots();
      } else {
        if (makerGemArea instanceof HTMLElement) {
          makerGemArea.hidden = true;
        }
        if (makerToggle instanceof HTMLElement) {
          makerToggle.classList.remove('maker-toggle-button--active');
          makerToggle.textContent = '메이커';
        }
      }
    },

    deactivate() {
      enhancementState = null;
      selectedBaseItem = null;
      hidePicker();

      if (makerSection instanceof HTMLElement) {
        makerSection.hidden = true;
      }
    },

    resetMakerUI() {
      hidePicker();
      if (makerToggle instanceof HTMLElement) {
        makerToggle.classList.remove('maker-toggle-button--active');
        makerToggle.textContent = '메이커';
        makerToggle.disabled = true;
        if (makerSection instanceof HTMLElement) {
          makerSection.hidden = false;
        }
      }
      if (makerGemArea instanceof HTMLElement) {
        makerGemArea.hidden = true;
      }
      if (makerGemSlots instanceof HTMLElement) {
        makerGemSlots.replaceChildren();
      }
    },

    refreshGemView() {
      renderGemSlots();
      refreshEnhancedCard();
    },
  };
}

```

- [ ] **Step 2: Verify the module loads without syntax errors**

Run: `node --input-type=module -e "import { initMakerPanel } from './src/lib/makerPanel.mjs'; console.log('initMakerPanel is a function:', typeof initMakerPanel);"`

Expected: `initMakerPanel is a function: function`

Note: The module exports a function so this won't try to access DOM — it just validates syntax and imports resolve.

- [ ] **Step 3: Commit**

```bash
git add src/lib/makerPanel.mjs
git commit -m "feat: add makerPanel UI rendering for gem slots and pickers

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Integrate `enhancementState` and `makerPanel` into `enhancementPanel.mjs`

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`

- [ ] **Step 1: Update imports at the top of the file**

Replace line 1:
```js
import { createScrollState, applyScroll, revertToSlot, resetState, computeAccumulatedStats, formatScrollStatLine, computeAppliedScrollCount, computeRemainingSlots, computeGradeColor } from './scrollState.mjs';
```

With:
```js
import { formatScrollStatLine } from './scrollState.mjs';
import { createEnhancementState, applyScroll, revertToSlot, resetState, computeAccumulatedStats, computeAppliedScrollCount, computeRemainingSlots, computeGradeColor } from './enhancementState.mjs';
import { initMakerPanel } from './makerPanel.mjs';
```

Add import for `buildItemIconUrl` (already present on line 2, keep it).

- [ ] **Step 2: Replace `scrollState` variable with `enhancementState`**

Replace line 19:
```js
  let scrollState = null;
```

With:
```js
  let enhancementState = null;
```

- [ ] **Step 3: Add makerPanel DOM element queries after the existing querySelectors (after line 15)**

Add:
```js
  const makerSection = enhancementPanel?.querySelector('[data-maker-section]');
  const makerToggle = enhancementPanel?.querySelector('[data-maker-toggle]');
  const makerGemArea = enhancementPanel?.querySelector('[data-maker-gem-area]');
  const makerGemSlots = enhancementPanel?.querySelector('[data-maker-gem-slots]');
  const makerPicker = enhancementPanel?.querySelector('[data-maker-picker]');
  const makerPickerLabel = enhancementPanel?.querySelector('[data-maker-picker-label]');
  const makerPickerGrid = enhancementPanel?.querySelector('[data-maker-picker-grid]');
  const makerPickerBack = enhancementPanel?.querySelector('[data-maker-picker-back]');
```

- [ ] **Step 4: Initialize makerPanel after the querySelectors (after the new lines from Step 3)**

Add:
```js
  const makerPanel = initMakerPanel({
    makerSection,
    makerToggle,
    makerGemArea,
    makerGemSlots,
    makerPicker,
    makerPickerLabel,
    makerPickerGrid,
    makerPickerBack,
    renderEnhancedItemCard,
  });
```

- [ ] **Step 5: Update `renderSlotRow` to reference `enhancementState.scrollState`**

Replace every `scrollState` reference inside `renderSlotRow` (lines 52-88) with `enhancementState.scrollState`:

- Line 52: `if (!(slotCheckpointRow instanceof HTMLElement) || !scrollState)` → `if (!(slotCheckpointRow instanceof HTMLElement) || !enhancementState)`
- Line 58: `for (let i = 0; i < scrollState.slotCount; i++)` → `for (let i = 0; i < enhancementState.scrollState.slotCount; i++)`
- Line 64: `const scroll = scrollState.slots[i];` → `const scroll = enhancementState.scrollState.slots[i];`
- Line 65: `const isCurrent = i === scrollState.currentSlot;` → `const isCurrent = i === enhancementState.scrollState.currentSlot;`
- Line 78: `revertToSlot(scrollState, i);` → `revertToSlot(enhancementState, i);`

- [ ] **Step 6: Update `renderScrollList` click handler to reference `enhancementState`**

Replace lines 156-169:

```js
        option.addEventListener('click', () => {
          if (!scrollState || !selectedBaseItem) {
            return;
          }

          const applied = applyScroll(scrollState, scroll);
          if (!applied) {
            return;
          }

          hideScrollDetail();
          renderSlotRow();
          refreshEnhancedCard();
        });
```

With:
```js
        option.addEventListener('click', () => {
          if (!enhancementState || !selectedBaseItem) {
            return;
          }

          const applied = applyScroll(enhancementState, scroll);
          if (!applied) {
            return;
          }

          hideScrollDetail();
          renderSlotRow();
          refreshEnhancedCard();
        });
```

- [ ] **Step 7: Update `refreshEnhancedCard` to use `enhancementState`**

Replace lines 175-186:

```js
  const refreshEnhancedCard = () => {
    if (!selectedBaseItem || !scrollState) {
      return;
    }

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, scrollState);
    const remaining = computeRemainingSlots(scrollState);
    const appliedCount = computeAppliedScrollCount(scrollState);
    const gradeColor = computeGradeColor(scrollState);

    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor);
  };
```

With:
```js
  const refreshEnhancedCard = () => {
    if (!selectedBaseItem || !enhancementState) {
      return;
    }

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    const remaining = computeRemainingSlots(enhancementState);
    const appliedCount = computeAppliedScrollCount(enhancementState);
    const gradeColor = computeGradeColor(enhancementState);

    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor);
  };
```

- [ ] **Step 8: Update `activatePanel2` to use `enhancementState` and call `makerPanel.activate`**

Replace lines 188-222:

```js
  const activatePanel2 = (item) => {
    if (!(enhancementPanel instanceof HTMLElement) ||
        !(enhancementDormant instanceof HTMLElement) ||
        !(enhancementActive instanceof HTMLElement) ||
        !(enhancementEquipmentKind instanceof HTMLElement)) {
      return;
    }

    const upgradeSlots = item.stats?.upgradeSlots ?? 0;

    if (upgradeSlots <= 0 || !Number.isFinite(upgradeSlots)) {
      enhancementPanel.hidden = false;
      enhancementDormant.hidden = true;
      enhancementActive.hidden = true;

      if (enhancementMessage instanceof HTMLElement) {
        enhancementMessage.textContent = '강화 불가능한 아이템입니다';
        enhancementMessage.hidden = false;
      }
      return;
    }

    selectedBaseItem = item;
    scrollState = createScrollState(upgradeSlots);

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = true;
    enhancementActive.hidden = false;
    enhancementEquipmentKind.textContent = item.equipmentKind;

    hideScrollDetail();
    renderSlotRow();
    renderScrollList(item.equipmentKind);
    refreshEnhancedCard();
  };
```

With:
```js
  const activatePanel2 = (item) => {
    if (!(enhancementPanel instanceof HTMLElement) ||
        !(enhancementDormant instanceof HTMLElement) ||
        !(enhancementActive instanceof HTMLElement) ||
        !(enhancementEquipmentKind instanceof HTMLElement)) {
      return;
    }

    const upgradeSlots = item.stats?.upgradeSlots ?? 0;

    if (upgradeSlots <= 0 || !Number.isFinite(upgradeSlots)) {
      enhancementPanel.hidden = false;
      enhancementDormant.hidden = true;
      enhancementActive.hidden = true;

      if (enhancementMessage instanceof HTMLElement) {
        enhancementMessage.textContent = '강화 불가능한 아이템입니다';
        enhancementMessage.hidden = false;
      }
      makerPanel.deactivate();
      return;
    }

    selectedBaseItem = item;
    enhancementState = createEnhancementState(upgradeSlots, item.requiredLevel ?? 0);

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = true;
    enhancementActive.hidden = false;
    enhancementEquipmentKind.textContent = item.equipmentKind;

    hideScrollDetail();
    renderSlotRow();
    renderScrollList(item.equipmentKind);
    makerPanel.activate(enhancementState, item);
    refreshEnhancedCard();
  };
```

- [ ] **Step 9: Update resetButton click handler to use `enhancementState`**

Replace lines 224-233:

```js
  resetButton?.addEventListener('click', () => {
    if (!scrollState || !selectedBaseItem) {
      return;
    }

    resetState(scrollState);
    hideScrollDetail();
    renderSlotRow();
    refreshEnhancedCard();
  });
```

With:
```js
  resetButton?.addEventListener('click', () => {
    if (!enhancementState || !selectedBaseItem) {
      return;
    }

    resetState(enhancementState);
    hideScrollDetail();
    renderSlotRow();
    makerPanel.resetMakerUI();
    refreshEnhancedCard();
  });
```

- [ ] **Step 10: Verify the module loads without syntax errors**

Run: `node --input-type=module -e "import { initEnhancementPanel } from './src/lib/enhancementPanel.mjs'; console.log('initEnhancementPanel is a function:', typeof initEnhancementPanel);"`

Expected: `initEnhancementPanel is a function: function`

- [ ] **Step 11: Commit**

```bash
git add src/lib/enhancementPanel.mjs
git commit -m "feat: integrate enhancementState and makerPanel into enhancement panel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Final build verification

**Files:**
- All modified files

- [ ] **Step 1: Run the Astro build**

Run:
```bash
npx astro build --root /Users/andykim/Desktop/project/ScrollBluePill/.claude/worktrees/maker-gem-design 2>&1
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify all new modules are bundled**

Run:
```bash
ls -la /Users/andykim/Desktop/project/ScrollBluePill/.claude/worktrees/maker-gem-design/dist/
```

Expected: `dist/` directory populated with built output.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: verify build after Maker integration

Co-Authored-By: Claude <noreply@anthropic.com>"
```
