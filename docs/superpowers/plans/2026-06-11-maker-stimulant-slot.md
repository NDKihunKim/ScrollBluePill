# Maker Stimulant Slot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a special 촉진제 Maker slot before the existing gem slots, with per-stat `-5..+5` input that may include zero values and contributes to simulated item stats.

**Architecture:** Keep 촉진제 state separate from ordinary `gemSlots` in `enhancementState.mjs`. Let `makerPanel.mjs` render and edit the special slot because it already owns the Maker lifecycle. Reuse the chaos stepper interaction style without moving chaos logic out of `enhancementPanel.mjs`.

**Tech Stack:** Astro page source, browser-side ES modules, Node `node:test`, existing MapleStory.io icon helper.

---

## File Structure

- Modify `src/lib/enhancementState.mjs`: add stimulant state helpers and include stimulant deltas in stat and grade calculations.
- Modify `src/lib/makerPanel.mjs`: render the special slot, render the stimulant input panel, apply/clear stimulant state, refresh the result card.
- Modify `src/pages/index.astro`: add CSS for the special slot and input panel while preserving existing normal gem slot styling.
- Create `tests/enhancement-state.test.mjs`: focused behavior tests for stimulant state and stat computation.
- Modify `tests/calculator-input-contract.test.mjs`: source contract for the special slot text, icon id, and displayed label.

---

### Task 1: Add Failing Enhancement State Tests

**Files:**
- Create: `tests/enhancement-state.test.mjs`
- Production file covered by Task 2: `src/lib/enhancementState.mjs`

- [ ] **Step 1: Write the failing test**

Create `tests/enhancement-state.test.mjs` with:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
	createEnhancementState,
	activateMaker,
	deactivateMaker,
	applyStimulant,
	clearStimulant,
	resetState,
	computeAccumulatedStats,
	computeGradeColor,
	computeRemainingSlots,
} from '../src/lib/enhancementState.mjs';

test('enhancement state initializes and clears maker stimulant separately from gem slots', () => {
	const state = createEnhancementState(7, 80);

	assert.equal(state.stimulantSlot, null);
	assert.equal(computeRemainingSlots(state), 7);

	activateMaker(state);
	assert.equal(applyStimulant(state, { str: 0, dex: -3, maxHp: 5 }), true);
	assert.deepEqual(state.stimulantSlot, { stats: { str: 0, dex: -3, maxHp: 5 } });
	assert.equal(computeRemainingSlots(state), 7);

	clearStimulant(state);
	assert.equal(state.stimulantSlot, null);

	assert.equal(applyStimulant(state, { str: 2 }), true);
	deactivateMaker(state);
	assert.equal(state.stimulantSlot, null);
});

test('maker stimulant contributes zero, negative, and positive deltas to accumulated stats', () => {
	const state = createEnhancementState(7, 80);

	assert.equal(applyStimulant(state, { str: 0, dex: -3, luk: 5 }), true);

	assert.deepEqual(
		computeAccumulatedStats({ str: 10, dex: 8, luk: 1, upgradeSlots: 7 }, state),
		{ str: 10, dex: 5, luk: 6, upgradeSlots: 7 },
	);
});

test('maker stimulant grade color includes stimulant deltas', () => {
	const state = createEnhancementState(7, 80);

	assert.equal(applyStimulant(state, { str: 2, dex: 2, luk: 2 }), true);

	assert.equal(computeGradeColor(state), '#3366ff');

	resetState(state);
	assert.equal(state.stimulantSlot, null);
	assert.equal(computeGradeColor(state), '#ffffff');
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `node --test tests/enhancement-state.test.mjs`

Expected: FAIL because `applyStimulant` and `clearStimulant` are not exported.

### Task 2: Implement Stimulant State

**Files:**
- Modify: `src/lib/enhancementState.mjs`
- Test: `tests/enhancement-state.test.mjs`

- [ ] **Step 1: Add stimulant state and helpers**

In `src/lib/enhancementState.mjs`:

```js
export function createEnhancementState(upgradeSlots, requiredLevel) {
  const scrollState = _createScrollState(upgradeSlots);
  const gemSlotCount = computeGemSlotCount(requiredLevel);
  const gemSlots = new Array(gemSlotCount).fill(null);
  const makerActive = false;
  const stimulantSlot = null;

  return { scrollState, gemSlots, gemSlotCount, makerActive, stimulantSlot };
}

export function applyStimulant(state, stats) {
  if (!stats || typeof stats !== 'object') {
    return false;
  }

  const normalizedStats = {};
  for (const [key, value] of Object.entries(stats)) {
    if (Number.isFinite(value)) {
      normalizedStats[key] = value;
    }
  }

  state.stimulantSlot = { stats: normalizedStats };
  return true;
}

export function clearStimulant(state) {
  state.stimulantSlot = null;
}
```

Update `deactivateMaker` and `resetGems` so they call `clearStimulant(state)`.

- [ ] **Step 2: Include stimulant stats in computations**

In `computeAccumulatedStats`, after the normal gem loop:

```js
  if (state.stimulantSlot?.stats) {
    for (const [key, value] of Object.entries(state.stimulantSlot.stats)) {
      if (Number.isFinite(value)) {
        accumulated[key] = (accumulated[key] ?? 0) + value;
      }
    }
  }
```

In `computeGradeColor`, after the normal gem loop:

```js
  if (state.stimulantSlot?.stats) {
    for (const [key, value] of Object.entries(state.stimulantSlot.stats)) {
      if (!Number.isFinite(value)) continue;

      if (HP_MP_KEYS.has(key)) {
        totalAddedConstants += Math.round(value / 10);
      } else {
        totalAddedConstants += value;
      }
    }
  }
```

- [ ] **Step 3: Run the focused test**

Run: `node --test tests/enhancement-state.test.mjs`

Expected: PASS.

### Task 3: Add Failing Source Contract for UI

**Files:**
- Modify: `tests/calculator-input-contract.test.mjs`
- Production file covered by Task 4: `src/lib/makerPanel.mjs`
- Production file covered by Task 4: `src/pages/index.astro`

- [ ] **Step 1: Add source contract assertions**

Append this test to `tests/calculator-input-contract.test.mjs`:

```js
test('maker stimulant slot source contract is present', async () => {
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');

	assert.match(indexSource, /maker-gem-slot--stimulant/);
	assert.match(indexSource, /content:\s*'\(촉진제\)'/);
	assert.match(makerPanelSource, /STIMULANT_ITEM_ID\s*=\s*4130000/);
	assert.match(makerPanelSource, /buildItemIconUrl\(STIMULANT_ITEM_ID\)/);
	assert.match(makerPanelSource, /nameSpan\.textContent\s*=\s*'촉진제'/);
	assert.match(makerPanelSource, /applyStimulant/);
	assert.match(makerPanelSource, /clearStimulant/);
});
```

- [ ] **Step 2: Run the contract test to verify it fails**

Run: `node --test tests/calculator-input-contract.test.mjs`

Expected: FAIL because the special slot CSS and Maker panel source do not exist yet.

### Task 4: Implement Maker Stimulant UI

**Files:**
- Modify: `src/lib/makerPanel.mjs`
- Modify: `src/pages/index.astro`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Import stimulant helpers and define constants**

In `src/lib/makerPanel.mjs`, extend the enhancementState import with `applyStimulant` and `clearStimulant`.

Add near the existing `SLOT_COUNT` constant:

```js
  const STIMULANT_ITEM_ID = 4130000;
  const STIMULANT_STAT_LIMIT = 5;
  const NON_STIMULANT_STAT_KEYS = new Set(['upgradeSlots', 'attackSpeed']);
  let stimulantValues = new Map();
```

- [ ] **Step 2: Add eligible stat and stepper helpers**

Add helpers inside `initMakerPanel`:

```js
  const getStimulantStatKeys = () => {
    if (!selectedBaseItem || !enhancementState) return [];

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    return Object.keys(accumulatedStats)
      .filter((key) => !NON_STIMULANT_STAT_KEYS.has(key))
      .filter((key) => Number.isFinite(accumulatedStats[key]))
      .filter((key) => accumulatedStats[key] > 0);
  };

  const updateStimulantStepperDisplay = (rowEl, key) => {
    const valueDisplay = rowEl.querySelector('.maker-stimulant-stepper-value');
    if (!valueDisplay) return;

    const value = stimulantValues.get(key) ?? 0;
    valueDisplay.textContent = value > 0 ? `+${value}` : String(value);
  };
```

- [ ] **Step 3: Add special slot rendering**

Add `renderStimulantSlot` before `renderGemSlots` and call it from the beginning of `renderGemSlots` before looping normal gem slots:

```js
  const renderStimulantSlot = () => {
    const box = document.createElement('div');
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.className = 'maker-gem-slot maker-gem-slot--stimulant';

    if (enhancementState?.stimulantSlot) {
      box.classList.add('maker-gem-slot--filled');

      const img = document.createElement('img');
      img.src = buildItemIconUrl(STIMULANT_ITEM_ID);
      img.alt = '';
      img.loading = 'lazy';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'maker-gem-slot-name';
      nameSpan.textContent = '촉진제';

      box.append(img, nameSpan);

      const xBtn = document.createElement('span');
      xBtn.setAttribute('role', 'button');
      xBtn.setAttribute('tabindex', '0');
      xBtn.className = 'slot-box-x';
      xBtn.setAttribute('aria-label', '촉진제 슬롯 지우기');
      xBtn.textContent = '×';
      xBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearStimulant(enhancementState);
        stimulantValues = new Map();
        hidePicker();
        renderGemSlots();
        refreshEnhancedCard();
      });
      xBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          xBtn.click();
        }
      });
      box.append(xBtn);
    }

    box.addEventListener('click', () => {
      renderGemSlots();
      renderStimulantInputPanel();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        box.click();
      }
    });

    makerGemSlots.append(box);
  };
```

- [ ] **Step 4: Add stimulant input panel rendering**

Add a `renderStimulantInputPanel` helper that uses `makerPicker` as the panel container:

```js
  const renderStimulantInputPanel = () => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement) ||
        !enhancementState) {
      return;
    }

    pendingGemKey = null;
    editingSlotIndex = -1;
    makerPickerLabel.textContent = '촉진제 스탯 입력';
    makerPickerGrid.replaceChildren();
    makerPickerGrid.classList.add('maker-stimulant-input-panel');
    makerPicker.hidden = false;
    if (makerPickerBack instanceof HTMLElement) makerPickerBack.hidden = true;

    const existingStats = enhancementState.stimulantSlot?.stats ?? {};
    const statKeys = getStimulantStatKeys();
    stimulantValues = new Map();
    statKeys.forEach((key) => {
      stimulantValues.set(key, Number.isFinite(existingStats[key]) ? existingStats[key] : 0);
    });

    if (statKeys.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'chaos-empty-message';
      msg.textContent = '적용할 스탯이 없습니다';
      makerPickerGrid.append(msg);
      return;
    }

    statKeys.forEach((key) => {
      const row = document.createElement('div');
      row.className = 'chaos-stat-row maker-stimulant-stat-row';

      const label = document.createElement('span');
      label.className = 'chaos-stat-label';
      label.textContent = statLabelByKey[key] ?? key;

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'chaos-stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        const cur = stimulantValues.get(key) ?? 0;
        if (cur > -STIMULANT_STAT_LIMIT) {
          stimulantValues.set(key, cur - 1);
          updateStimulantStepperDisplay(row, key);
        }
      });

      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'chaos-stepper-value maker-stimulant-stepper-value';
      const initialVal = stimulantValues.get(key) ?? 0;
      valueDisplay.textContent = initialVal > 0 ? `+${initialVal}` : String(initialVal);

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'chaos-stepper-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        const cur = stimulantValues.get(key) ?? 0;
        if (cur < STIMULANT_STAT_LIMIT) {
          stimulantValues.set(key, cur + 1);
          updateStimulantStepperDisplay(row, key);
        }
      });

      row.append(label, minusBtn, valueDisplay, plusBtn);
      makerPickerGrid.append(row);
    });

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'chaos-apply-button maker-stimulant-apply-button';
    applyBtn.textContent = '적용';
    applyBtn.addEventListener('click', () => {
      const stats = {};
      for (const key of statKeys) {
        stats[key] = stimulantValues.get(key) ?? 0;
      }
      applyStimulant(enhancementState, stats);
      hidePicker();
      renderGemSlots();
      refreshEnhancedCard();
    });

    makerPickerGrid.append(applyBtn);
  };
```

Before rendering normal gem picker content in `renderStep1Picker` and `renderStep2Picker`, remove the stimulant panel class:

```js
    makerPickerGrid.classList.remove('maker-stimulant-input-panel');
```

- [ ] **Step 5: Add CSS**

In `src/pages/index.astro`, extend Maker styles:

```css
	:global(.maker-gem-slot--stimulant) {
		border-style: dashed;
		background: var(--surface-soft);
	}

	:global(.maker-gem-slot--stimulant)::after {
		content: '(촉진제)';
	}

	:global(.maker-gem-slot--stimulant.maker-gem-slot--filled) {
		border-style: solid;
		background: var(--surface);
	}

	:global(.maker-stimulant-input-panel) {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	:global(.maker-stimulant-apply-button) {
		align-self: flex-end;
	}
```

- [ ] **Step 6: Run the contract test**

Run: `node --test tests/calculator-input-contract.test.mjs`

Expected: PASS.

### Task 5: Verify Build and Focused Tests

**Files:**
- Verify: all touched files

- [ ] **Step 1: Run focused tests**

Run:

```bash
node --test tests/enhancement-state.test.mjs tests/calculator-input-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full available test suite**

Run:

```bash
node --test tests/*.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: Astro build completes successfully.

- [ ] **Step 4: Review git diff**

Run:

```bash
git diff -- src/lib/enhancementState.mjs src/lib/makerPanel.mjs src/pages/index.astro tests/enhancement-state.test.mjs tests/calculator-input-contract.test.mjs
```

Expected: Diff only contains stimulant slot changes and tests.
