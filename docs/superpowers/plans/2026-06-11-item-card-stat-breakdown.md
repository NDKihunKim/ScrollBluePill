# Item Card Stat Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show enhanced item-card stat totals with a parenthesized breakdown of original, maker, and scroll contributions.

**Architecture:** Add stat breakdown calculation to `src/lib/enhancementState.mjs`, where enhancement math already lives. Pass the breakdown through the existing `renderEnhancedItemCard` callback and keep the Astro page script responsible only for display formatting.

**Tech Stack:** Astro page script, plain browser DOM APIs, Node built-in test runner, existing enhancement-state module.

---

## File Structure

- Modify `src/lib/enhancementState.mjs`
  - Add `computeStatBreakdown(baseStats, state)`.
  - Keep maker total as gem contribution plus stimulant contribution.
  - Keep scroll total as all applied scroll stat contribution.
- Modify `tests/enhancement-state.test.mjs`
  - Add state-level tests for original, maker, scroll, total breakdown values.
- Modify `src/lib/enhancementPanel.mjs`
  - Import `computeStatBreakdown`.
  - Pass breakdown data into `renderEnhancedItemCard`.
- Modify `src/lib/makerPanel.mjs`
  - Import `computeStatBreakdown`.
  - Pass breakdown data into `renderEnhancedItemCard`.
- Modify `src/pages/index.astro`
  - Import `computeStatBreakdown` for the initial selected item card.
  - Add a small formatter for `+total (original+maker+scroll)`.
  - Update `renderEnhancedItemCard` to receive and use breakdown data for non-metadata stats.
- Modify `tests/calculator-input-contract.test.mjs`
  - Add a source contract that verifies the display path uses breakdown data and excludes metadata rows.

---

### Task 1: Add Stat Breakdown State Helper

**Files:**
- Modify: `src/lib/enhancementState.mjs`
- Test: `tests/enhancement-state.test.mjs`

- [ ] **Step 1: Write the failing helper tests**

Add `computeStatBreakdown` to the import list in `tests/enhancement-state.test.mjs`:

```js
import {
	createEnhancementState,
	activateMaker,
	deactivateMaker,
	applyGem,
	applyScroll,
	applyStimulant,
	clearStimulant,
	resetState,
	computeAccumulatedStats,
	computeGradeColor,
	computeRemainingSlots,
	computeStatBreakdown,
} from '../src/lib/enhancementState.mjs';
```

Add these tests after the existing accumulated-stat test:

```js
test('stat breakdown separates original, maker, scroll, and total values', () => {
	const state = createEnhancementState(7, 80);

	assert.equal(applyScroll(state, {
		id: 2040000,
		nameKo: '테스트 주문서',
		stats: { str: 5, dex: -2 },
	}), true);

	assert.deepEqual(
		computeStatBreakdown({ str: 15, dex: 10, upgradeSlots: 7 }, state),
		{
			str: { original: 15, maker: 0, scroll: 5, total: 20 },
			dex: { original: 10, maker: 0, scroll: -2, total: 8 },
			upgradeSlots: { original: 7, maker: 0, scroll: 0, total: 7 },
		},
	);
});

test('stat breakdown includes maker gems and stimulant in maker total', () => {
	const state = createEnhancementState(7, 80);
	activateMaker(state);

	assert.equal(applyGem(state, 0, 'power', 0), true);
	assert.equal(applyStimulant(state, { str: 2, dex: -1 }), true);
	assert.equal(applyScroll(state, {
		id: 2040001,
		nameKo: '테스트 주문서',
		stats: { str: 5, dex: 3 },
	}), true);

	assert.deepEqual(
		computeStatBreakdown({ str: 15, dex: 10, upgradeSlots: 7 }, state),
		{
			str: { original: 15, maker: 4, scroll: 5, total: 24 },
			dex: { original: 10, maker: -1, scroll: 3, total: 12 },
			upgradeSlots: { original: 7, maker: 0, scroll: 0, total: 7 },
		},
	);
});
```

- [ ] **Step 2: Run the helper tests to verify RED**

Run:

```bash
node --test --test-name-pattern "stat breakdown" tests/enhancement-state.test.mjs
```

Expected: FAIL because `computeStatBreakdown` is not exported yet.

- [ ] **Step 3: Implement the helper**

In `src/lib/enhancementState.mjs`, add this exported helper after `computeAccumulatedStats`:

```js
export function computeStatBreakdown(baseStats, state) {
  const breakdown = {};

  const ensureEntry = (key) => {
    if (!breakdown[key]) {
      breakdown[key] = { original: 0, maker: 0, scroll: 0, total: 0 };
    }
    return breakdown[key];
  };

  if (baseStats) {
    for (const [key, value] of Object.entries(baseStats)) {
      if (!Number.isFinite(value)) continue;
      const entry = ensureEntry(key);
      entry.original += value;
      entry.total += value;
    }
  }

  const { scrollState } = state;

  for (let i = 0; i < scrollState.slotCount; i++) {
    const scroll = scrollState.slots[i];
    if (!scroll?.stats) continue;

    for (const [key, value] of Object.entries(scroll.stats)) {
      if (!Number.isFinite(value)) continue;
      const entry = ensureEntry(key);
      entry.scroll += value;
      entry.total += value;
    }
  }

  for (let i = 0; i < state.gemSlots.length; i++) {
    const gemSlot = state.gemSlots[i];
    if (!gemSlot) continue;

    const gem = getGemTypeByKey(gemSlot.gemKey);
    if (!gem) continue;

    const statKey = gem.stat;
    const value = gem.values[gemSlot.gradeIndex];
    if (!statKey || !Number.isFinite(value)) continue;

    const entry = ensureEntry(statKey);
    entry.maker += value;
    entry.total += value;
  }

  if (state.stimulantSlot?.stats) {
    for (const [key, value] of Object.entries(state.stimulantSlot.stats)) {
      if (!Number.isFinite(value)) continue;
      const entry = ensureEntry(key);
      entry.maker += value;
      entry.total += value;
    }
  }

  return breakdown;
}
```

- [ ] **Step 4: Run the helper tests to verify GREEN**

Run:

```bash
node --test --test-name-pattern "stat breakdown" tests/enhancement-state.test.mjs
```

Expected: PASS with 2 matching tests.

- [ ] **Step 5: Run the full enhancement-state tests**

Run:

```bash
node --test tests/enhancement-state.test.mjs
```

Expected: PASS.

---

### Task 2: Wire Breakdown Into Item Card Refreshes

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`
- Modify: `src/lib/makerPanel.mjs`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Write the failing source contract**

Add this test near the other enhancement source contracts in `tests/calculator-input-contract.test.mjs`:

```js
test('enhanced item card receives stat breakdown data', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');

	assert.match(enhancementPanelSource, /computeStatBreakdown/);
	assert.match(enhancementPanelSource, /const statBreakdown = computeStatBreakdown\(selectedBaseItem\.stats, enhancementState\);/);
	assert.match(enhancementPanelSource, /renderEnhancedItemCard\(selectedBaseItem,\s*accumulatedStats,\s*remaining,\s*appliedCount,\s*gradeColor,\s*statBreakdown\)/);

	assert.match(makerPanelSource, /computeStatBreakdown/);
	assert.match(makerPanelSource, /const statBreakdown = computeStatBreakdown\(selectedBaseItem\.stats, enhancementState\);/);
	assert.match(makerPanelSource, /renderEnhancedItemCard\(selectedBaseItem,\s*accumulatedStats,\s*remaining,\s*appliedCount,\s*gradeColor,\s*statBreakdown\)/);
});
```

- [ ] **Step 2: Run the contract to verify RED**

Run:

```bash
node --test --test-name-pattern "enhanced item card receives stat breakdown data" tests/calculator-input-contract.test.mjs
```

Expected: FAIL because neither panel imports or passes `computeStatBreakdown` yet.

- [ ] **Step 3: Update `enhancementPanel.mjs`**

Change the import from `src/lib/enhancementPanel.mjs`:

```js
import { createEnhancementState, applyScroll, revertToSlot, resetState, computeAccumulatedStats, computeStatBreakdown, computeAppliedScrollCount, computeRemainingSlots, computeGradeColor } from './enhancementState.mjs';
```

Inside `refreshEnhancedCard`, after `accumulatedStats`:

```js
    const statBreakdown = computeStatBreakdown(selectedBaseItem.stats, enhancementState);
```

Change the render call to:

```js
    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor, statBreakdown);
```

- [ ] **Step 4: Update `makerPanel.mjs`**

Change the import from `src/lib/makerPanel.mjs`:

```js
import { activateMaker, deactivateMaker, applyGem, revertGemSlot, applyStimulant, clearStimulant, computeAccumulatedStats, computeStatBreakdown, computeGradeColor, computeAppliedScrollCount, computeRemainingSlots } from './enhancementState.mjs';
```

Inside `refreshEnhancedCard`, after `accumulatedStats`:

```js
    const statBreakdown = computeStatBreakdown(selectedBaseItem.stats, enhancementState);
```

Change the render call to:

```js
    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor, statBreakdown);
```

- [ ] **Step 5: Run the contract to verify GREEN**

Run:

```bash
node --test --test-name-pattern "enhanced item card receives stat breakdown data" tests/calculator-input-contract.test.mjs
```

Expected: PASS.

---

### Task 3: Render Breakdown Suffixes In The Item Card

**Files:**
- Modify: `src/pages/index.astro`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Write the failing display-path contract**

Add this test near the item-card source contracts in `tests/calculator-input-contract.test.mjs`:

```js
test('item card formats enhanced stats with non-zero breakdown parts', () => {
	assert.match(indexSource, /formatStatBreakdownValue/);
	assert.match(indexSource, /const parts = \[breakdown\.original, breakdown\.maker, breakdown\.scroll\]/);
	assert.match(indexSource, /\.filter\(\(value, index\) => index === 0 \|\| value !== 0\)/);
	assert.match(indexSource, /return `\$\{formatStatValue\(key, breakdown\.total\)\} \(\$\{parts\.map\(formatBreakdownPart\)\.join\(''\)\}\)`;/);
	assert.match(indexSource, /key === 'attackSpeed'/);
	assert.match(indexSource, /key === 'upgradeSlots'/);
});
```

- [ ] **Step 2: Run the display-path contract to verify RED**

Run:

```bash
node --test --test-name-pattern "item card formats enhanced stats with non-zero breakdown parts" tests/calculator-input-contract.test.mjs
```

Expected: FAIL because `formatStatBreakdownValue` does not exist yet.

- [ ] **Step 3: Import `computeStatBreakdown` in `index.astro`**

At the top of the page script, change the enhancement import to:

```js
import { computeStatBreakdown } from '../lib/enhancementState.mjs';
```

Keep this import inside the existing `<script>` block, near the other `../lib/...` imports.

- [ ] **Step 4: Add formatter helpers in `index.astro`**

Add these helpers near `formatStatValue` and `createItemLine`:

```js
	const formatBreakdownPart = (value, index) => {
		if (index === 0) {
			return String(value);
		}
		return value > 0 ? `+${value}` : String(value);
	};

	const formatStatBreakdownValue = (key, breakdown) => {
		if (!breakdown || !Number.isFinite(breakdown.total)) {
			return '';
		}

		const hasEnhancement = breakdown.maker !== 0 || breakdown.scroll !== 0;
		if (!hasEnhancement) {
			return formatStatValue(key, breakdown.total);
		}

		const parts = [breakdown.original, breakdown.maker, breakdown.scroll]
			.filter((value, index) => index === 0 || value !== 0);

		return `${formatStatValue(key, breakdown.total)} (${parts.map(formatBreakdownPart).join('')})`;
	};
```

- [ ] **Step 5: Update initial item-card rendering**

In `renderSelectedItemCard(item)`, compute a base-only breakdown before stat rows:

```js
		const baseStatBreakdown = computeStatBreakdown(item.stats, {
			scrollState: { slotCount: 0, slots: [] },
			gemSlots: [],
			stimulantSlot: null,
		});
```

For non-metadata stats, use:

```js
			const breakdown = baseStatBreakdown[key];
			const value = key === 'attackSpeed' ? resolveAttackSpeed(item) : breakdown?.total;
			if (Number.isFinite(value)) {
				const displayValue =
					key === 'attackSpeed'
						? formatStatValue(key, value)
						: formatStatBreakdownValue(key, breakdown);
				selectedItemStats.append(createItemLine(label, displayValue));
			}
```

- [ ] **Step 6: Update enhanced item-card rendering**

Change the signature:

```js
		const renderEnhancedItemCard = (item, accumulatedStats, remainingSlots, appliedCount, gradeColor, statBreakdown = {}) => {
```

In the stat row loop, replace the non-metadata display branch with:

```js
			const breakdown = statBreakdown?.[key];
			const value = key === 'attackSpeed' ? resolveAttackSpeed(item) : (breakdown?.total ?? accumulatedStats?.[key]);
			// Hide stats that dropped to 0 or below (e.g. from negative chaos scrolls).
			// attackSpeed and upgradeSlots are metadata, not chaos-modifiable stats.
			if (Number.isFinite(value) && (key === 'attackSpeed' || key === 'upgradeSlots' || value > 0)) {
				const displayValue =
					key === 'attackSpeed'
						? formatStatValue(key, value)
						: formatStatBreakdownValue(key, breakdown ?? {
							original: item.stats?.[key] ?? 0,
							maker: 0,
							scroll: value - (item.stats?.[key] ?? 0),
							total: value,
						});
				selectedItemStats.append(createItemLine(label, displayValue));
			}
```

- [ ] **Step 7: Run the display-path contract to verify GREEN**

Run:

```bash
node --test --test-name-pattern "item card formats enhanced stats with non-zero breakdown parts" tests/calculator-input-contract.test.mjs
```

Expected: PASS.

---

### Task 4: Verify Integrated Behavior

**Files:**
- Verify only; no planned edits.

- [ ] **Step 1: Run focused state tests**

Run:

```bash
node --test tests/enhancement-state.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run focused source contracts**

Run:

```bash
node --test --test-name-pattern "stat breakdown|enhanced item card receives stat breakdown data|item card formats enhanced stats with non-zero breakdown parts" tests/calculator-input-contract.test.mjs
```

Expected: PASS for the matched contracts.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Run broad test suite summary**

Run:

```bash
node --test tests/*.test.mjs 2>&1 | rg -n "^# tests|^# pass|^# fail|^not ok|The input did not match|expected: 3680|actual: 2093|Visibility-hidden item count"
```

Expected: Existing unrelated failures may remain:

- manual search button text contract expects `수동 검색`
- generated Korean item index length expects `3680`
- dedupe report visibility-hidden count mismatch

- [ ] **Step 5: Browser verification**

Start the dev server:

```bash
npm run dev -- --host 127.0.0.1
```

Use the in-app browser to:

1. Select `자쿰의 투구`.
2. Confirm base card shows unenhanced stats without parentheses, e.g. `STR : +15`.
3. Apply a chaos scroll `+5` to STR.
4. Confirm item card shows `STR : +20 (15+5)`.
5. Enable Maker and apply maker/stimulant STR so maker and scroll both contribute.
6. Confirm item card shows a three-part breakdown such as `STR : +25 (15+5+5)`.
7. Confirm attack speed and upgrade slots do not use breakdown parentheses.
8. Check browser console errors.

- [ ] **Step 6: Stop the dev server**

Stop the dev server with `Ctrl-C`.

---

## Self-Review

- Spec coverage: original/maker/scroll breakdown, zero omission, stimulant included in maker, metadata exclusion, current hiding behavior, and no layout redesign are covered.
- Placeholder scan: no TBD/TODO/fill-in placeholders remain.
- Type consistency: helper name is consistently `computeStatBreakdown`; breakdown keys are consistently `original`, `maker`, `scroll`, and `total`.
- Scope: plan is focused on item-card stat breakdown and supporting tests only.
