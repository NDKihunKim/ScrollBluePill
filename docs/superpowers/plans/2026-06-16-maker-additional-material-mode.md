# Maker Additional Material Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add split `추옵` / probability modes to the Maker stimulant slot and special variable gems, with correct expected-value behavior.

**Architecture:** Store a `mode: 'manual' | 'probability'` on stimulant and variable-gem stat entries. Keep item preview behavior unchanged by always adding entered stats in `enhancementState`, but make expected-value strategy construction pre-apply only manual entries and treat probability-mode entries as RNG sources. Render split slot overlays in `makerPanel.mjs` and a small help tooltip beside `추가 재료`.

**Tech Stack:** Astro page markup/CSS, browser DOM code in `.mjs`, Node built-in test runner.

---

## File Structure

- `src/lib/enhancementState.mjs`: normalize and store entry modes for stimulant and variable gem stat entries.
- `src/lib/expectedValue/exactEngine.mjs`: deterministic strategy detection should read probability-mode variable gem entries correctly.
- `src/lib/expectedValue/strategyOptimizer.mjs`: RNG source counts should read probability-mode variable gem entries correctly.
- `src/lib/expectedValue/monteCarloEngine.mjs`: simulation should use manual variable gem stats as fixed contributions, and probability-mode gems as random contributions.
- `src/pages/index.astro`: expected-value strategy construction and CSS/markup for help tooltip and split slot overlay.
- `src/lib/makerPanel.mjs`: split slot actions, mode-aware stat panel apply behavior, and visible slot mode labels.
- `tests/enhancement-state.test.mjs`: state mode tests.
- `tests/expected-value-*.test.mjs`: EV behavior tests.
- `tests/calculator-input-contract.test.mjs` and `tests/expected-value-ui-contract.test.mjs`: source-contract tests.

## Task 1: Store Modes In Enhancement State

**Files:**
- Modify: `src/lib/enhancementState.mjs`
- Test: `tests/enhancement-state.test.mjs`

- [ ] **Step 1: Write failing tests for stimulant and variable gem modes**

Append these tests near the existing stimulant and variable gem tests in `tests/enhancement-state.test.mjs`:

```js
test('applyStimulant stores manual and probability modes', () => {
  const state = createEnhancementState(7, 80);

  applyStimulant(state, { str: 2 }, 'manual');
  assert.deepEqual(state.stimulantSlot, {
    stats: { str: 2 },
    mode: 'manual',
  });

  applyStimulant(state, { str: 4 }, 'probability');
  assert.deepEqual(state.stimulantSlot, {
    stats: { str: 4 },
    mode: 'probability',
  });
});

test('applyStimulant defaults missing mode to manual', () => {
  const state = createEnhancementState(7, 80);

  applyStimulant(state, { dex: 1 });

  assert.equal(state.stimulantSlot.mode, 'manual');
});

test('applyVariableGem stores manual and probability modes', () => {
  const state = createEnhancementState(7, 80);

  assert.equal(applyVariableGem(state, 0, 'darkCrystal', { str: 3 }, 'manual'), true);
  assert.deepEqual(state.gemSlots[0], {
    gemKey: 'darkCrystal',
    stats: { str: 3 },
    mode: 'manual',
  });

  assert.equal(applyVariableGem(state, 0, 'darkCrystal', { str: 5 }, 'probability'), true);
  assert.deepEqual(state.gemSlots[0], {
    gemKey: 'darkCrystal',
    stats: { str: 5 },
    mode: 'probability',
  });
});

test('applyVariableGem defaults missing mode to manual', () => {
  const state = createEnhancementState(7, 80);

  applyVariableGem(state, 0, 'blackAmethyst', { weaponAttack: 1 });

  assert.equal(state.gemSlots[0].mode, 'manual');
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
node --test tests/enhancement-state.test.mjs
```

Expected: FAIL because `mode` is missing from `stimulantSlot` and variable gem slots.

- [ ] **Step 3: Implement minimal state normalization**

In `src/lib/enhancementState.mjs`, add constants and helper near the top:

```js
export const MATERIAL_MODE_MANUAL = 'manual';
export const MATERIAL_MODE_PROBABILITY = 'probability';

function normalizeMaterialMode(mode) {
  return mode === MATERIAL_MODE_PROBABILITY
    ? MATERIAL_MODE_PROBABILITY
    : MATERIAL_MODE_MANUAL;
}
```

Change `applyStimulant` signature and assignment:

```js
export function applyStimulant(state, stats, mode = MATERIAL_MODE_MANUAL) {
  if (!stats || typeof stats !== 'object') {
    return false;
  }

  const normalizedStats = {};
  for (const [key, value] of Object.entries(stats)) {
    if (Number.isFinite(value)) {
      normalizedStats[key] = value;
    }
  }

  state.stimulantSlot = {
    stats: normalizedStats,
    mode: normalizeMaterialMode(mode),
  };
  return true;
}
```

Change `applyVariableGem` signature and assignment:

```js
export function applyVariableGem(state, slotIndex, gemKey, stats, mode = MATERIAL_MODE_MANUAL) {
  if (slotIndex < 0 || slotIndex >= state.gemSlotCount) {
    return false;
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    if (i !== slotIndex && state.gemSlots[i]?.gemKey === gemKey) {
      return false;
    }
  }

  const gem = getGemTypeByKey(gemKey);
  if (!gem || gem.behavior !== 'variable') {
    return false;
  }

  const normalizedStats = {};
  for (const [key, value] of Object.entries(stats ?? {})) {
    if (Number.isFinite(value)) {
      normalizedStats[key] = value;
    }
  }

  state.gemSlots[slotIndex] = {
    gemKey,
    stats: normalizedStats,
    mode: normalizeMaterialMode(mode),
  };
  return true;
}
```

- [ ] **Step 4: Run tests to verify GREEN**

Run:

```bash
node --test tests/enhancement-state.test.mjs
```

Expected: PASS.

## Task 2: Make Expected Value Respect Manual Vs Probability Modes

**Files:**
- Modify: `src/lib/expectedValue/exactEngine.mjs`
- Modify: `src/lib/expectedValue/strategyOptimizer.mjs`
- Modify: `src/lib/expectedValue/monteCarloEngine.mjs`
- Modify: `src/pages/index.astro`
- Test: `tests/expected-value-exact-engine.test.mjs`
- Test: `tests/expected-value-monte-carlo.test.mjs`
- Test: `tests/expected-value-strategy-optimizer.test.mjs`
- Test: `tests/expected-value-ui-contract.test.mjs`

- [ ] **Step 1: Write failing deterministic strategy tests**

Append to `tests/expected-value-exact-engine.test.mjs`:

```js
test('isDeterministicStrategy treats manual variable gem stats as deterministic', () => {
  const strategy = {
    makerChoices: [
      { gemKey: 'darkCrystal', stats: { str: 3 }, mode: 'manual' },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: false,
  };

  assert.equal(isDeterministicStrategy(strategy), true);
});

test('isDeterministicStrategy treats probability variable gem stats as random', () => {
  const strategy = {
    makerChoices: [
      { gemKey: 'darkCrystal', stats: { str: 3 }, mode: 'probability' },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: false,
  };

  assert.equal(isDeterministicStrategy(strategy), false);
});
```

- [ ] **Step 2: Write failing RNG source count test**

Append to `tests/expected-value-strategy-optimizer.test.mjs`:

```js
test('countRngSources ignores manual variable gem stats and counts probability variable gems', () => {
  assert.equal(countRngSources({
    makerChoices: [
      { gemKey: 'darkCrystal', stats: { str: 3 }, mode: 'manual' },
      { gemKey: 'blackAmethyst', stats: { weaponAttack: 2 }, mode: 'probability' },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
  }), 1);
});
```

- [ ] **Step 3: Write failing Monte Carlo tests for manual fixed stats**

Append to `tests/expected-value-monte-carlo.test.mjs`:

```js
test('manual variable gem stats are applied as fixed stats in Monte Carlo strategy simulation', () => {
  const result = runStrategyMonteCarloSimulation(
    {
      makerChoices: [
        { gemKey: 'darkCrystal', stats: { str: 3 }, mode: 'manual' },
      ],
      scrollSequence: [],
      useItemLevelUp: false,
      useStimulant: false,
    },
    { str: 10 },
    { statThresholds: { str: 3 }, gradeThreshold: null },
    20,
    123,
  );

  assert.equal(result.successProbability, 1);
});

test('probability variable gem stats are not pre-applied as fixed stats in Monte Carlo strategy simulation', () => {
  const result = runStrategyMonteCarloSimulation(
    {
      makerChoices: [
        { gemKey: 'darkCrystal', stats: { str: 5 }, mode: 'probability' },
      ],
      scrollSequence: [],
      useItemLevelUp: false,
      useStimulant: false,
    },
    { str: 10 },
    { statThresholds: { str: 99 }, gradeThreshold: null },
    20,
    123,
  );

  assert.equal(result.successProbability, 0);
});
```

- [ ] **Step 4: Write failing source contract for EV strategy construction**

Append to `tests/expected-value-ui-contract.test.mjs`:

```js
test('expected value strategy separates manual material stats from probability material sources', async () => {
  const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.match(indexSource, /MATERIAL_MODE_PROBABILITY/);
  assert.match(indexSource, /s\.mode\s*===\s*MATERIAL_MODE_PROBABILITY/);
  assert.match(indexSource, /preApply\(enhancementState\.stimulantSlot\.stats\)/);
  assert.match(indexSource, /preApply\(s\.stats\)/);
  assert.match(indexSource, /useStimulant:\s*enhancementState\.stimulantSlot\?\.mode\s*===\s*MATERIAL_MODE_PROBABILITY/);
});
```

- [ ] **Step 5: Run tests to verify RED**

Run:

```bash
node --test tests/expected-value-exact-engine.test.mjs tests/expected-value-strategy-optimizer.test.mjs tests/expected-value-monte-carlo.test.mjs tests/expected-value-ui-contract.test.mjs
```

Expected: FAIL because mode-aware EV behavior is not implemented.

- [ ] **Step 6: Update deterministic and RNG-source helpers**

In `src/lib/expectedValue/exactEngine.mjs`, replace the random gem check:

```js
for (const choice of makerChoices) {
  if (!choice || !choice.gemKey) continue;
  if (choice.stats && choice.mode !== 'probability') continue;
  if (isRandomGem(choice.gemKey)) return false;
}
```

In `src/lib/expectedValue/strategyOptimizer.mjs`, replace the random gem count check:

```js
for (const choice of makerChoices) {
  if (!choice || !choice.gemKey) continue;
  if (choice.stats && choice.mode !== 'probability') continue;
  if (isRandomGem(choice.gemKey)) count++;
}
```

- [ ] **Step 7: Update Monte Carlo gem simulation**

In `src/lib/expectedValue/monteCarloEngine.mjs`, change the Maker choice loop in `simulateStrategyTrial`:

```js
for (const choice of makerChoices) {
  if (!choice?.gemKey) continue;

  if (choice.stats && choice.mode !== 'probability') {
    addStats(state, choice.stats);
    continue;
  }

  const gemStats = computeGemContribution(
    choice.gemKey,
    inferMakerChoiceGrade(choice),
    cleanStats,
    rng,
  );
  addStats(state, gemStats);
}
```

- [ ] **Step 8: Update EV strategy construction in the Astro page**

In `src/pages/index.astro`, import the material mode constant from `enhancementState.mjs` where enhancement helpers are imported:

```js
import {
  computeAccumulatedStats,
  computeStatBreakdown,
  MATERIAL_MODE_PROBABILITY,
} from '../lib/enhancementState.mjs';
```

In `runEvCalculation`, build `makerChoices` with mode:

```js
const makerChoices = enhancementState.gemSlots
  .filter(s => s !== null)
  .map(s => (s.stats
    ? { gemKey: s.gemKey, stats: s.stats, mode: s.mode ?? 'manual' }
    : { gemKey: s.gemKey, grade: s.gradeIndex }));
```

Pre-apply manual material stats after `preApply` is declared and before `effectiveTargetConditions`:

```js
if (enhancementState.stimulantSlot?.stats &&
    enhancementState.stimulantSlot.mode !== MATERIAL_MODE_PROBABILITY) {
  preApply(enhancementState.stimulantSlot.stats);
}

for (const s of enhancementState.gemSlots ?? []) {
  if (s?.stats && s.mode !== MATERIAL_MODE_PROBABILITY) {
    preApply(s.stats);
  }
}
```

Set stimulant probability mode explicitly:

```js
const userStrategy = {
  makerChoices,
  scrollSequence,
  useItemLevelUp: false,
  useStimulant: enhancementState.stimulantSlot?.mode === MATERIAL_MODE_PROBABILITY,
};
```

- [ ] **Step 9: Run tests to verify GREEN**

Run:

```bash
node --test tests/expected-value-exact-engine.test.mjs tests/expected-value-strategy-optimizer.test.mjs tests/expected-value-monte-carlo.test.mjs tests/expected-value-ui-contract.test.mjs
```

Expected: PASS.

## Task 3: Add Split Controls To Maker Slots

**Files:**
- Modify: `src/lib/makerPanel.mjs`
- Modify: `src/pages/index.astro`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Write failing source-contract tests**

Append to `tests/calculator-input-contract.test.mjs`:

```js
test('maker additional material slots expose split mode controls', async () => {
  const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');

  assert.match(makerPanelSource, /MATERIAL_MODE_MANUAL/);
  assert.match(makerPanelSource, /MATERIAL_MODE_PROBABILITY/);
  assert.match(makerPanelSource, /maker-slot-mode-overlay/);
  assert.match(makerPanelSource, /추옵/);
  assert.match(makerPanelSource, /촉진제/);
  assert.match(makerPanelSource, /확률 적용/);
  assert.match(makerPanelSource, /renderStimulantInputPanel\(MATERIAL_MODE_MANUAL\)/);
  assert.match(makerPanelSource, /renderStimulantInputPanel\(MATERIAL_MODE_PROBABILITY\)/);
  assert.match(makerPanelSource, /renderVariableGemInputPanel\(gem,\s*MATERIAL_MODE_MANUAL\)/);
  assert.match(makerPanelSource, /renderVariableGemInputPanel\(gem,\s*MATERIAL_MODE_PROBABILITY\)/);
});

test('maker additional material help tooltip source contract is present', async () => {
  assert.match(indexSource, /maker-material-help/);
  assert.match(indexSource, /추옵은 이미 붙어있는 추가 옵션/);
  assert.match(indexSource, /촉진제는 제작 확률/);
  assert.match(indexSource, /확률 적용은 흑수정/);
  assert.match(indexSource, /:global\(\.maker-slot-mode-overlay\)/);
  assert.match(indexSource, /:global\(\.maker-material-help-tooltip\)/);
});
```

- [ ] **Step 2: Run tests to verify RED**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: FAIL because split controls and tooltip do not exist.

- [ ] **Step 3: Import material mode constants into maker panel**

In `src/lib/makerPanel.mjs`, add `MATERIAL_MODE_MANUAL` and `MATERIAL_MODE_PROBABILITY` to the existing `enhancementState.mjs` import:

```js
import {
  activateMaker,
  deactivateMaker,
  applyGem,
  applyVariableGem,
  revertGemSlot,
  applyStimulant,
  clearStimulant,
  computeAccumulatedStats,
  computeStatBreakdown,
  computeGradeColor,
  computeAppliedScrollCount,
  computeRemainingSlots,
  HP_MP_KEYS,
  MATERIAL_MODE_MANUAL,
  MATERIAL_MODE_PROBABILITY,
} from './enhancementState.mjs';
```

- [ ] **Step 4: Add a local split-overlay helper**

In `src/lib/makerPanel.mjs`, inside `initMakerPanel` before `renderStimulantSlot`, add:

```js
const appendModeOverlay = (box, topLabel, bottomLabel, onTop, onBottom) => {
  const overlay = document.createElement('div');
  overlay.className = 'maker-slot-mode-overlay';

  const topButton = document.createElement('button');
  topButton.type = 'button';
  topButton.className = 'maker-slot-mode-button maker-slot-mode-button--top';
  topButton.textContent = topLabel;
  topButton.addEventListener('click', (e) => {
    e.stopPropagation();
    onTop();
  });

  const bottomButton = document.createElement('button');
  bottomButton.type = 'button';
  bottomButton.className = 'maker-slot-mode-button maker-slot-mode-button--bottom';
  bottomButton.textContent = bottomLabel;
  bottomButton.addEventListener('click', (e) => {
    e.stopPropagation();
    onBottom();
  });

  overlay.append(topButton, bottomButton);
  box.append(overlay);
};
```

- [ ] **Step 5: Make stimulant input panel mode-aware**

Change `renderStimulantInputPanel` signature:

```js
const renderStimulantInputPanel = (mode = MATERIAL_MODE_MANUAL) => {
```

Set the panel label by mode:

```js
makerPickerLabel.textContent = mode === MATERIAL_MODE_PROBABILITY
  ? '촉진제 스탯 입력'
  : '추옵 스탯 입력';
```

Change the apply call:

```js
applyStimulant(enhancementState, stats, mode);
```

- [ ] **Step 6: Add split controls to stimulant slot**

Replace the stimulant slot click handler body with:

```js
box.addEventListener('click', () => {
  activeStimulantSlot = true;
  editingSlotIndex = -1;
  renderGemSlots();
});
```

Then append the overlay before `makerGemSlots.append(box);`:

```js
appendModeOverlay(
  box,
  '추옵',
  '촉진제',
  () => {
    pendingGemKey = null;
    activeStimulantSlot = true;
    editingSlotIndex = -1;
    renderGemSlots();
    renderStimulantInputPanel(MATERIAL_MODE_MANUAL);
  },
  () => {
    pendingGemKey = null;
    activeStimulantSlot = true;
    editingSlotIndex = -1;
    renderGemSlots();
    renderStimulantInputPanel(MATERIAL_MODE_PROBABILITY);
  },
);
```

- [ ] **Step 7: Make variable gem input panel mode-aware**

Change `renderVariableGemInputPanel` signature:

```js
const renderVariableGemInputPanel = (gem, mode = MATERIAL_MODE_MANUAL) => {
```

Set the panel label by mode:

```js
makerPickerLabel.textContent = mode === MATERIAL_MODE_PROBABILITY
  ? `${gem.nameKo} 확률 적용`
  : `${gem.nameKo} 추옵 입력`;
```

Change the apply call:

```js
const ok = applyVariableGem(enhancementState, editingSlotIndex, gem.key, stats, mode);
```

- [ ] **Step 8: Add split controls for variable gems in the picker**

In `renderStep1Picker`, replace the variable gem click path:

```js
if (gem.behavior === 'variable') {
  renderVariableGemInputPanel(gem);
} else {
  renderStep2Picker();
}
```

with:

```js
if (gem.behavior === 'variable') {
  renderVariableGemInputPanel(gem, MATERIAL_MODE_MANUAL);
} else {
  renderStep2Picker();
}
```

Then, for filled variable gem slots in `renderGemSlots`, append a split overlay after the clear button append:

```js
if (gem?.behavior === 'variable') {
  appendModeOverlay(
    box,
    '추옵',
    '확률 적용',
    () => {
      activeStimulantSlot = false;
      editingSlotIndex = i;
      pendingGemKey = gem.key;
      renderGemSlots();
      renderVariableGemInputPanel(gem, MATERIAL_MODE_MANUAL);
    },
    () => {
      activeStimulantSlot = false;
      editingSlotIndex = i;
      pendingGemKey = gem.key;
      renderGemSlots();
      renderVariableGemInputPanel(gem, MATERIAL_MODE_PROBABILITY);
    },
  );
}
```

- [ ] **Step 9: Add tooltip markup in the Maker section**

In `src/pages/index.astro`, replace:

```astro
<p class="enhancement-section-label">추가 재료</p>
```

with:

```astro
<p class="enhancement-section-label maker-material-label">
  <span>추가 재료</span>
  <span class="maker-material-help" tabindex="0" aria-label="추가 재료 모드 설명">
    ?
    <span class="maker-material-help-tooltip" role="tooltip">
      추옵은 이미 붙어있는 추가 옵션을 직접 입력합니다. 촉진제는 제작 확률을 계산에 포함합니다. 확률 적용은 흑수정/어둠의 크리스탈 결과 확률을 계산에 포함합니다.
    </span>
  </span>
</p>
```

- [ ] **Step 10: Add CSS for split controls and tooltip**

In `src/pages/index.astro`, near existing Maker gem slot CSS, add:

```css
:global(.maker-slot-mode-overlay) {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-rows: 1fr 1fr;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
  border-radius: inherit;
  overflow: hidden;
}

:global(.maker-gem-slot:hover .maker-slot-mode-overlay),
:global(.maker-gem-slot:focus-within .maker-slot-mode-overlay),
:global(.maker-gem-slot--active .maker-slot-mode-overlay) {
  opacity: 1;
  pointer-events: auto;
}

:global(.maker-slot-mode-button) {
  border: 0;
  background: rgba(1, 47, 64, 0.88);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  cursor: pointer;
}

:global(.maker-slot-mode-button--top) {
  border-bottom: 1px solid rgba(255, 255, 255, 0.35);
}

:global(.maker-material-label) {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
}

:global(.maker-material-help) {
  position: relative;
  display: inline-grid;
  place-items: center;
  width: 1rem;
  height: 1rem;
  border: 1px solid currentColor;
  border-radius: 999px;
  font-size: 0.72rem;
  line-height: 1;
  cursor: help;
}

:global(.maker-material-help-tooltip) {
  position: absolute;
  left: 50%;
  bottom: calc(100% + 0.45rem);
  width: min(18rem, 75vw);
  transform: translateX(-50%);
  padding: 0.55rem 0.65rem;
  border: 1px solid rgba(1, 47, 64, 0.18);
  border-radius: 6px;
  background: #fff;
  color: #1f2933;
  box-shadow: 0 8px 20px rgba(1, 47, 64, 0.16);
  font-size: 0.75rem;
  font-weight: 500;
  line-height: 1.45;
  opacity: 0;
  pointer-events: none;
  transition: opacity 120ms ease;
  z-index: 20;
}

:global(.maker-material-help:hover .maker-material-help-tooltip),
:global(.maker-material-help:focus .maker-material-help-tooltip) {
  opacity: 1;
}
```

- [ ] **Step 11: Run tests to verify GREEN**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: PASS.

## Task 4: Full Verification

**Files:**
- No new files.

- [ ] **Step 1: Run focused test suite**

Run:

```bash
node --test tests/enhancement-state.test.mjs tests/expected-value-exact-engine.test.mjs tests/expected-value-strategy-optimizer.test.mjs tests/expected-value-monte-carlo.test.mjs tests/expected-value-ui-contract.test.mjs tests/calculator-input-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

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

- [ ] **Step 4: Commit implementation**

Run:

```bash
git status --short
git add src/lib/enhancementState.mjs src/lib/expectedValue/exactEngine.mjs src/lib/expectedValue/strategyOptimizer.mjs src/lib/expectedValue/monteCarloEngine.mjs src/lib/makerPanel.mjs src/pages/index.astro tests/enhancement-state.test.mjs tests/expected-value-exact-engine.test.mjs tests/expected-value-strategy-optimizer.test.mjs tests/expected-value-monte-carlo.test.mjs tests/expected-value-ui-contract.test.mjs tests/calculator-input-contract.test.mjs
git commit -m "feat: add maker material probability modes"
```

Expected: commit succeeds and includes only files related to the implementation.

## Self-Review

- Spec coverage: state modes, stimulant split control, special gem split control, help tooltip, EV manual/probability semantics, deterministic/RNG classification, and verification are covered.
- Placeholder scan: no placeholder markers, vague "add tests", or undefined future steps.
- Type consistency: the plan consistently uses `mode: 'manual' | 'probability'`, `MATERIAL_MODE_MANUAL`, and `MATERIAL_MODE_PROBABILITY`.
