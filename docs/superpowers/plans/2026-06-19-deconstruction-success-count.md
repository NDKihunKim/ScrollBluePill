# Deconstruction Success Count Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an exact successful-scroll count editor with valid slot accounting, item-card suffix rendering, and exact-count scroll-only analysis.

**Architecture:** Keep slot coupling in a small pure state module and let the Astro page only render and dispatch state changes. Change the scroll-only engine API from a maximum-slot input to an exact successful-scroll count so every returned strategy has the requested length.

**Tech Stack:** Astro 6, browser JavaScript modules, Node.js `node:test`, Playwright for browser verification

---

## File map

- Create `src/lib/deconstruction/slotState.mjs`: pure slot invariant and transition functions.
- Create `tests/deconstruction-slot-state.test.mjs`: slot transition unit tests.
- Modify `src/lib/deconstruction/engine.mjs`: exact successful-scroll-count input.
- Modify `tests/deconstruction-engine.test.mjs`: exact-count engine contracts.
- Create `tests/deconstruction-ui-contract.test.mjs`: source-level UI wiring contract.
- Modify `src/pages/deconstruction.astro`: editor row, page state, item-card suffix, engine call.

### Task 1: Add the slot-state model

**Files:**
- Create: `src/lib/deconstruction/slotState.mjs`
- Create: `tests/deconstruction-slot-state.test.mjs`

- [ ] **Step 1: Write the failing slot-state tests**

```js
// tests/deconstruction-slot-state.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDeconstructionSlotState,
  inferFailedScrollCount,
  setRemainingSlotCount,
  setSuccessfulScrollCount,
} from '../src/lib/deconstruction/slotState.mjs';

test('new item starts with zero successes and all slots remaining', () => {
  assert.deepEqual(createDeconstructionSlotState(7), {
    maxSlots: 7,
    successfulScrollCount: 0,
    remainingSlots: 7,
  });
});

test('increasing successes reduces only overflowing remaining slots', () => {
  const initial = createDeconstructionSlotState(7);
  assert.deepEqual(setSuccessfulScrollCount(initial, 3), {
    maxSlots: 7,
    successfulScrollCount: 3,
    remainingSlots: 4,
  });
});

test('decreasing successes preserves remaining slots and creates failures', () => {
  const state = { maxSlots: 7, successfulScrollCount: 4, remainingSlots: 2 };
  const next = setSuccessfulScrollCount(state, 2);
  assert.deepEqual(next, { maxSlots: 7, successfulScrollCount: 2, remainingSlots: 2 });
  assert.equal(inferFailedScrollCount(next), 3);
});

test('remaining slots clamp without changing successful scrolls', () => {
  const state = { maxSlots: 7, successfulScrollCount: 3, remainingSlots: 1 };
  assert.deepEqual(setRemainingSlotCount(state, 99), {
    maxSlots: 7,
    successfulScrollCount: 3,
    remainingSlots: 4,
  });
});

test('all inputs clamp to non-negative integers', () => {
  assert.deepEqual(createDeconstructionSlotState(-2), {
    maxSlots: 0,
    successfulScrollCount: 0,
    remainingSlots: 0,
  });
  const state = createDeconstructionSlotState(7);
  assert.equal(setSuccessfulScrollCount(state, 20).successfulScrollCount, 7);
  assert.equal(setSuccessfulScrollCount(state, -1).successfulScrollCount, 0);
  assert.equal(setRemainingSlotCount(state, -1).remainingSlots, 0);
});
```

- [ ] **Step 2: Run the tests and verify the missing-module failure**

Run: `node --test tests/deconstruction-slot-state.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `slotState.mjs`.

- [ ] **Step 3: Implement the minimal pure state module**

```js
// src/lib/deconstruction/slotState.mjs
const toCount = (value) => Math.max(0, Math.trunc(Number.isFinite(value) ? value : 0));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export function createDeconstructionSlotState(maxSlots) {
  const normalizedMax = toCount(maxSlots);
  return {
    maxSlots: normalizedMax,
    successfulScrollCount: 0,
    remainingSlots: normalizedMax,
  };
}

export function setSuccessfulScrollCount(state, value) {
  const successfulScrollCount = clamp(toCount(value), 0, state.maxSlots);
  return {
    ...state,
    successfulScrollCount,
    remainingSlots: Math.min(state.remainingSlots, state.maxSlots - successfulScrollCount),
  };
}

export function setRemainingSlotCount(state, value) {
  return {
    ...state,
    remainingSlots: clamp(toCount(value), 0, state.maxSlots - state.successfulScrollCount),
  };
}

export function inferFailedScrollCount(state) {
  return state.maxSlots - state.successfulScrollCount - state.remainingSlots;
}
```

- [ ] **Step 4: Run the slot-state tests**

Run: `node --test tests/deconstruction-slot-state.test.mjs`

Expected: 5 tests PASS.

- [ ] **Step 5: Commit the slot-state model**

```bash
git add src/lib/deconstruction/slotState.mjs tests/deconstruction-slot-state.test.mjs
git commit -m "feat: add deconstruction slot state model"
```

### Task 2: Make scroll-only analysis require an exact scroll count

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`
- Modify: `src/lib/deconstruction/engine.mjs`

- [ ] **Step 1: Add exact-count tests and update existing callers**

Replace every `upgradeSlots` test input with the exact count needed by that fixture. Add:

```js
test('requires exactly the requested successful scroll count', () => {
  const scrollsByEquipmentKind = new Map([['Glove', [{
    id: 6001,
    nameKo: '공격력 주문서 100%',
    equipmentKind: 'Glove',
    behavior_type: 'fixed',
    stats: { weaponAttack: 2 },
  }]]]);

  const exact = enumerateStrategies({
    targetDeltas: { weaponAttack: 6 },
    successfulScrollCount: 3,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind,
  });
  const tooFew = enumerateStrategies({
    targetDeltas: { weaponAttack: 6 },
    successfulScrollCount: 2,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind,
  });
  const tooMany = enumerateStrategies({
    targetDeltas: { weaponAttack: 6 },
    successfulScrollCount: 4,
    equipmentKind: 'Glove',
    scrollsByEquipmentKind,
  });

  assert.equal(exact.strategies.length, 1);
  assert.equal(exact.strategies[0].scrolls.length, 3);
  assert.equal(tooFew.strategies.length, 0);
  assert.equal(tooMany.strategies.length, 0);
});

test('zero successful scrolls cannot satisfy a positive scroll-only target', () => {
  const result = enumerateStrategies({
    targetDeltas: { str: 1 },
    successfulScrollCount: 0,
    equipmentKind: 'Cape',
    scrollsByEquipmentKind: new Map([['Cape', [{
      id: 6002, nameKo: '힘 주문서 100%', behavior_type: 'fixed', stats: { str: 1 },
    }]]]),
  });
  assert.deepEqual(result.strategies, []);
});
```

- [ ] **Step 2: Run the engine tests and verify the API failure**

Run: `node --test tests/deconstruction-engine.test.mjs`

Expected: FAIL because `successfulScrollCount` is not consumed and old fixtures still depend on `upgradeSlots`.

- [ ] **Step 3: Change the engine API and terminal conditions**

In `enumerateStrategies`, replace `upgradeSlots` with `successfulScrollCount`, normalize it, and use the exact count as the recursion budget:

```js
export function enumerateStrategies({
  targetDeltas,
  successfulScrollCount,
  equipmentKind,
  scrollsByEquipmentKind,
}) {
  const requiredScrollCount = Math.max(
    0,
    Math.trunc(Number.isFinite(successfulScrollCount) ? successfulScrollCount : 0),
  );
  // existing setup remains

  function dfs(fixedIdx, remainingScrolls, remainingDeltas, chosen) {
    if (isExactMatch(remainingDeltas) && chosen.length === requiredScrollCount) {
      addStrategy(chosen);
      return strategies.length >= MAX_STRATEGIES;
    }
    if (remainingScrolls === 0 || chosen.length >= requiredScrollCount) return false;
    // retain fixed and chaos branches, decrementing remainingScrolls per application
  }

  dfs(0, requiredScrollCount, { ...targetDeltas }, []);
  return { strategies, total: strategies.length, truncated };
}
```

Extract the existing repeated strategy insertion block into a local `addStrategy(chosen)` helper so both fixed and chaos paths use one deduplication path. Do not change probability behavior in this phase.

- [ ] **Step 4: Run the engine tests**

Run: `node --test tests/deconstruction-engine.test.mjs`

Expected: all tests PASS and every returned `strategy.scrolls.length` equals its fixture's `successfulScrollCount`.

- [ ] **Step 5: Commit the exact-count engine API**

```bash
git add src/lib/deconstruction/engine.mjs tests/deconstruction-engine.test.mjs
git commit -m "feat: require exact deconstruction scroll count"
```

### Task 3: Wire the new editor and item-card suffix

**Files:**
- Create: `tests/deconstruction-ui-contract.test.mjs`
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Write the failing UI contract tests**

```js
// tests/deconstruction-ui-contract.test.mjs
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../src/pages/deconstruction.astro', import.meta.url), 'utf8');

test('successful-scroll editor appears immediately before remaining slots', () => {
  const successIndex = source.indexOf('data-decon-success-row');
  const remainingIndex = source.indexOf('decon-slot-row');
  assert.ok(successIndex >= 0);
  assert.ok(remainingIndex > successIndex);
  assert.match(source, /주문서 성공 횟수/);
  assert.match(source, /data-decon-success-min/);
  assert.match(source, /data-decon-success-max/);
});

test('page uses the slot-state transitions and exact engine input', () => {
  assert.match(source, /createDeconstructionSlotState/);
  assert.match(source, /setSuccessfulScrollCount/);
  assert.match(source, /setRemainingSlotCount/);
  assert.match(source, /successfulScrollCount:\s*deconSlotState\.successfulScrollCount/);
  assert.doesNotMatch(source, /upgradeSlots,\s*equipmentKind,\s*scrollsByEquipmentKind/);
});

test('item-card title uses the expected-value suffix format', () => {
  assert.match(source, /successfulScrollCount > 0 \? ` \(\+\$\{successfulScrollCount\}\)` : ''/);
});
```

- [ ] **Step 2: Run the UI contract tests and verify failure**

Run: `node --test tests/deconstruction-ui-contract.test.mjs`

Expected: FAIL because the success row and slot-state imports do not exist.

- [ ] **Step 3: Add the successful-scroll row**

Insert directly before `.decon-slot-row`:

```astro
<div class="chaos-stat-row decon-success-row" data-decon-success-row>
  <span class="chaos-stat-label">주문서 성공 횟수</span>
  <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-success-min>MIN</button>
  <button type="button" class="chaos-stepper-btn" data-decon-success-dec>−</button>
  <span class="chaos-stepper-value" data-decon-success-value>0</span>
  <button type="button" class="chaos-stepper-btn" data-decon-success-inc>+</button>
  <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-success-max>MAX</button>
</div>
```

Give `.decon-success-row` the same spacing rule as `.decon-slot-row`; do not duplicate the shared stepper declarations.

- [ ] **Step 4: Replace independent slot numbers with the pure state model**

Import the three state functions, add success-row DOM references, and keep one state value:

```js
import {
  createDeconstructionSlotState,
  setRemainingSlotCount,
  setSuccessfulScrollCount,
} from '../lib/deconstruction/slotState.mjs';

let deconSlotState = createDeconstructionSlotState(0);

const renderDeconSlotState = () => {
  deconSuccessValue.textContent = String(deconSlotState.successfulScrollCount);
  deconSlotValue.textContent = String(deconSlotState.remainingSlots);
  updateTargetCard();
};

const updateSuccessfulScrollCount = (value) => {
  deconSlotState = setSuccessfulScrollCount(deconSlotState, value);
  renderDeconSlotState();
};

const updateRemainingSlotCount = (value) => {
  deconSlotState = setRemainingSlotCount(deconSlotState, value);
  renderDeconSlotState();
};
```

On item activation use `deconSlotState = createDeconstructionSlotState(item.stats?.upgradeSlots ?? 0)`. Replace `deconAvailableSlots` reads with `deconSlotState.remainingSlots`, and retain `deconSlotState.maxSlots` for stat editor range calculations.

- [ ] **Step 5: Wire MIN, decrement, increment, and MAX controls**

```js
deconSuccessMin?.addEventListener('click', () => updateSuccessfulScrollCount(0));
deconSuccessDec?.addEventListener('click', () => updateSuccessfulScrollCount(deconSlotState.successfulScrollCount - 1));
deconSuccessInc?.addEventListener('click', () => updateSuccessfulScrollCount(deconSlotState.successfulScrollCount + 1));
deconSuccessMax?.addEventListener('click', () => updateSuccessfulScrollCount(deconSlotState.maxSlots));

deconSlotMin?.addEventListener('click', () => updateRemainingSlotCount(0));
deconSlotDec?.addEventListener('click', () => updateRemainingSlotCount(deconSlotState.remainingSlots - 1));
deconSlotInc?.addEventListener('click', () => updateRemainingSlotCount(deconSlotState.remainingSlots + 1));
deconSlotMax?.addEventListener('click', () => updateRemainingSlotCount(deconSlotState.maxSlots));
```

- [ ] **Step 6: Update card rendering and analysis input**

At the start of `renderTargetItemCard`:

```js
const { successfulScrollCount, remainingSlots } = deconSlotState;
const titleSuffix = successfulScrollCount > 0 ? ` (+${successfulScrollCount})` : '';
selectedItemName.textContent = `${item.nameKo}${titleSuffix}`;
```

Render `remainingSlots` for `upgradeSlots`. In `runAnalysis`, call:

```js
const result = enumerateStrategies({
  targetDeltas,
  successfulScrollCount: deconSlotState.successfulScrollCount,
  equipmentKind,
  scrollsByEquipmentKind,
});
```

- [ ] **Step 7: Run focused tests**

Run: `node --test tests/deconstruction-slot-state.test.mjs tests/deconstruction-engine.test.mjs tests/deconstruction-ui-contract.test.mjs`

Expected: all tests PASS.

- [ ] **Step 8: Commit the page integration**

```bash
git add src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git commit -m "feat: add deconstruction success count editor"
```

### Task 4: Verify phase 1 end to end

**Files:**
- Verify only: no planned source changes

- [ ] **Step 1: Run the full Node test suite**

Run: `node --test tests/*.test.mjs`

Expected: all tests PASS.

- [ ] **Step 2: Build the Astro site**

Run: `npm run build`

Expected: exit code 0 and `dist/deconstruction/index.html` exists.

- [ ] **Step 3: Run browser verification**

Run `npm run dev -- --port 4321`, open `/deconstruction`, select an item with 7 slots, and verify:

1. Defaults show success `0`, remaining `7`, and no item-name suffix.
2. Increasing success to `3` changes remaining to `4` and adds `(+3)`.
3. Reducing remaining to `2`, then reducing success to `2`, leaves remaining at `2`.
4. Increasing remaining stops at `5`.
5. Selecting another item resets both values from the new clean item.
6. Analysis results contain exactly the selected number of scroll entries.
7. The two rows remain aligned at desktop and narrow viewport widths.

Expected: all seven checks pass with no browser-console errors.
