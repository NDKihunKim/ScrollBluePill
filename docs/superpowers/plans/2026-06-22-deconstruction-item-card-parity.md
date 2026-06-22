# Deconstruction Item Card Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show initial Reverse/Timeless item-level metadata and expected-value stat ordering on the deconstruction item card.

**Architecture:** Keep rendering in `deconstruction.astro`, where the selected-item card and asynchronously loaded item-level definitions already meet. Reuse `computeItemLevelUpCardMeta` for the initial level/EXP values, refresh the card after definitions load, and change only the stat-row ordering declaration.

**Tech Stack:** Astro page script, browser DOM APIs, Node.js built-in test runner.

---

## File Structure

- Modify `tests/deconstruction-ui-contract.test.mjs` to lock down item-level metadata rendering, asynchronous refresh, and attack-speed ordering.
- Modify `src/pages/deconstruction.astro` to reuse the existing metadata helper, append the two metadata rows, refresh after definitions load, and put attack speed first.

### Task 1: Add Item Card Parity Contract

**Files:**
- Test: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Write the failing contract test**

Add this test after `item card shows a success-count suffix only above zero and renders remaining slots`:

```js
test('item card mirrors expected-value level-up metadata and attack-speed placement', () => {
  assert.match(
    pageSource,
    /import \{ HP_MP_KEYS, computeItemLevelUpCardMeta \} from '\.\.\/lib\/enhancementState\.mjs';/,
  );

  const statRowsStart = pageSource.indexOf('const deconStatRows = [');
  const statRowsEnd = pageSource.indexOf('];', statRowsStart);
  assert.ok(statRowsStart >= 0 && statRowsEnd > statRowsStart);
  const statRowsSource = pageSource.slice(statRowsStart, statRowsEnd);
  const attackSpeedIndex = statRowsSource.indexOf("['공격속도', 'attackSpeed']");
  const strIndex = statRowsSource.indexOf("['STR', 'str']");
  assert.ok(attackSpeedIndex >= 0, 'missing attack-speed row');
  assert.ok(strIndex >= 0, 'missing STR row');
  assert.ok(
    attackSpeedIndex < strIndex,
    'attack speed must be the first stat row',
  );

  assert.match(
    pageSource,
    /const itemLevelUpMeta = computeItemLevelUpCardMeta\(\s*\{ itemLevelUpSlots: \[\] \},\s*itemLevelUpByItemId\.get\(item\.id\) \?\? null,\s*\);/,
  );
  assert.match(
    pageSource,
    /createItemLine\('ITEM LEV', itemLevelUpMeta\.itemLevel, 'selected-item-line--item-level'\)/,
  );
  assert.match(
    pageSource,
    /createItemLine\('ITEM EXP', itemLevelUpMeta\.itemExp, 'selected-item-line--item-level'\)/,
  );

  const levelMapIndex = pageSource.indexOf('itemLevelUpByItemId = new Map(');
  const loadEnd = pageSource.indexOf('\n  })\n  .catch', levelMapIndex);
  assert.ok(levelMapIndex >= 0 && loadEnd > levelMapIndex);
  assert.match(pageSource.slice(levelMapIndex, loadEnd), /updateTargetCard\(\);/);
});
```

- [ ] **Step 2: Run the focused test to verify RED**

Run:

```bash
node --test --test-name-pattern "item card mirrors expected-value" tests/deconstruction-ui-contract.test.mjs
```

Expected: FAIL because `computeItemLevelUpCardMeta` is not imported or used, the metadata rows are absent, and attack speed is not first.

- [ ] **Step 3: Commit the failing test**

```bash
git add tests/deconstruction-ui-contract.test.mjs
git commit -m "test: cover deconstruction item card parity"
```

### Task 2: Render Level-Up Metadata and Correct Stat Ordering

**Files:**
- Modify: `src/pages/deconstruction.astro`
- Test: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Import the existing metadata helper**

Replace:

```js
import { HP_MP_KEYS } from '../lib/enhancementState.mjs';
```

with:

```js
import { HP_MP_KEYS, computeItemLevelUpCardMeta } from '../lib/enhancementState.mjs';
```

- [ ] **Step 2: Move attack speed to the first stat row**

Change the start and end of `deconStatRows` so the complete declaration is:

```js
const deconStatRows = [
  ['공격속도', 'attackSpeed'],
  ['STR', 'str'],
  ['DEX', 'dex'],
  ['INT', 'int'],
  ['LUK', 'luk'],
  ['공격력', 'weaponAttack'],
  ['마력', 'magicAttack'],
  ['최대HP', 'maxHp'],
  ['최대MP', 'maxMp'],
  ['물리방어력', 'weaponDefense'],
  ['마법방어력', 'magicDefense'],
  ['명중률', 'accuracy'],
  ['회피율', 'avoidability'],
  ['이동속도', 'speed'],
  ['점프력', 'jump'],
  ['업그레이드 가능 횟수', 'upgradeSlots'],
];
```

- [ ] **Step 3: Append initial item-level metadata**

Immediately after the `requirementRows.forEach(...)` block in `renderTargetItemCard`, add:

```js
  const itemLevelUpMeta = computeItemLevelUpCardMeta(
    { itemLevelUpSlots: [] },
    itemLevelUpByItemId.get(item.id) ?? null,
  );
  if (itemLevelUpMeta) {
    selectedItemRequirements.append(
      createItemLine('ITEM LEV', itemLevelUpMeta.itemLevel, 'selected-item-line--item-level'),
    );
    selectedItemRequirements.append(
      createItemLine('ITEM EXP', itemLevelUpMeta.itemExp, 'selected-item-line--item-level'),
    );
  }
```

- [ ] **Step 4: Refresh the selected card after level-up definitions load**

After `updateLevelUpSourceEligibility();` in the `Promise.all(...).then(...)` handler, add:

```js
    updateTargetCard();
```

- [ ] **Step 5: Run the focused test to verify GREEN**

Run:

```bash
node --test --test-name-pattern "item card mirrors expected-value" tests/deconstruction-ui-contract.test.mjs
```

Expected: PASS for the matching contract test.

- [ ] **Step 6: Run the complete deconstruction UI contract**

Run:

```bash
node --test tests/deconstruction-ui-contract.test.mjs
```

Expected: all tests PASS with no failures.

- [ ] **Step 7: Commit the implementation**

```bash
git add src/pages/deconstruction.astro
git commit -m "fix: align deconstruction item card metadata"
```

### Task 3: Regression and Build Verification

**Files:**
- Verify: `src/pages/deconstruction.astro`
- Verify: `tests/deconstruction-*.test.mjs`

- [ ] **Step 1: Run all deconstruction tests**

Run:

```bash
node --test tests/deconstruction-*.test.mjs
```

Expected: all tests PASS with no failures.

- [ ] **Step 2: Run the production build**

Run:

```bash
npm run build
```

Expected: Astro completes the production build successfully with exit code `0`.

- [ ] **Step 3: Inspect the final scoped diff**

Run:

```bash
git diff HEAD~2 -- src/pages/deconstruction.astro tests/deconstruction-ui-contract.test.mjs
git status --short
```

Expected: only the approved item-card source and test changes appear; the worktree contains no unintended tracked changes.

## Self-Review

- Every design requirement maps to Task 1 contract coverage and Task 2 implementation.
- The helper name and metadata property names match `enhancementState.mjs`.
- The plan adds no new renderer abstraction or unrelated formatting changes.
- No placeholders remain.
