# Item Level-Up as Base Layer — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When `itemLevelUp` is enabled, restructure enumeration so levelUp is resolved first (outer loop), guaranteeing every returned strategy includes it. Remove the redundant 레벨업 primary filter chip from results.

**Architecture:** Branch in the main enumeration loop — when `itemLevelUp` is enabled, iterate levelUp contributions outside, scroll states inside, with 4 inner tiers (scroll-only, +stim, +gems, +stim+gems). When disabled, the existing 8-tier code is untouched. UI-side: remove the `itemLevelUp` entry from `FILTER_DEFS`.

**Tech Stack:** Vanilla JS (ESM), Node test runner, Astro

---

### Task 1: Engine — extract correction bounds helper

**Files:**
- Modify: `src/lib/deconstruction/engine.mjs`

- [ ] **Step 1: Extract correction bounds computation into a helper function**

Insert this function inside `enumerateStrategies`, immediately above where `correctionBounds` is currently computed (before the `const correctionBounds = {};` line ~456):

```js
function computeCorrectionBounds(targetKeys, { includeStimulant, includeGems, includeItemLevelUp }) {
  const bounds = {};
  for (const key of targetKeys) {
    let min = 0;
    let max = 0;

    if (includeStimulant) {
      min += Math.min(0, stimulantBounds[key].min);
      max += Math.max(0, stimulantBounds[key].max);
    }
    if (includeGems) {
      const values = gemContributions.map((c) => c.stats[key] || 0);
      min += Math.min(0, ...values);
      max += Math.max(0, ...values);
    }
    if (includeItemLevelUp) {
      const values = itemLevelContributions.map((c) => c.stats[key] || 0);
      min += Math.min(0, ...values);
      max += Math.max(0, ...values);
    }

    bounds[key] = { min, max };
  }
  return bounds;
}
```

Replace the existing inline `correctionBounds` computation with a call:

```js
const correctionBounds = computeCorrectionBounds(targetKeys, {
  includeStimulant: normalizedAllowedSources.stimulant,
  includeGems: normalizedAllowedSources.gems,
  includeItemLevelUp: normalizedAllowedSources.itemLevelUp,
});
```

- [ ] **Step 2: Run existing tests to confirm no regression**

Run: `node --test tests/deconstruction-engine.test.mjs`
Expected: All tests pass (pure extraction, no behavioral change)

- [ ] **Step 3: Commit**

```bash
git add src/lib/deconstruction/engine.mjs
git commit -m "refactor: extract computeCorrectionBounds helper in deconstruction engine

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Engine — restructure main loop with itemLevelUp outer loop

**Files:**
- Modify: `src/lib/deconstruction/engine.mjs`

- [ ] **Step 1: Build correction bounds without levelUp for scroll pruning**

After `correctionBounds` is computed and right before the `effectiveScrollStates` generation, add:

```js
const scrollCorrectionBounds = computeCorrectionBounds(targetKeys, {
  includeStimulant: normalizedAllowedSources.stimulant,
  includeGems: normalizedAllowedSources.gems,
  includeItemLevelUp: false,
});
```

- [ ] **Step 2: Replace the main loop with a branch on itemLevelUp**

Replace everything from `for (const ss of effectiveScrollStates) {` through the closing `}` of that loop (i.e., the entire tier-0-through-7 block) with:

```js
if (normalizedAllowedSources.itemLevelUp) {
  // ── ItemLevelUp is the base layer ──────────────────────────
  for (const ilc of itemLevelContributions) {
    if (tooManyResults) break;

    const remainingTarget = subtractVectors(effectiveTargetDeltas, ilc.stats, targetKeys);

    // Enumerate scroll states against the remaining target
    const scrollStates = normalizedAllowedSources.scrolls && normCount > 0
      ? enumerateExactCountScrollStates({
          scrolls,
          targetKeys,
          targetDeltas: remainingTarget,
          successfulScrollCount: normCount,
          correctionBounds: scrollCorrectionBounds,
        })
      : (normCount === 0
        ? [{ scrolls: [], stats: Object.fromEntries(targetKeys.map((k) => [k, 0])) }]
        : []);

    for (const ss of scrollStates) {
      if (tooManyResults) break;

      const residual = subtractVectors(remainingTarget, ss.stats, targetKeys);

      // Tier A (rank 0): scroll-only — fills remainingTarget exactly
      if (isExactVector(ss.stats, remainingTarget, targetKeys)) {
        addResult({
          scrolls: ss.scrolls,
          stimulant: null,
          gems: [],
          itemLevelUp: ilc,
          priorityRank: 0,
        });
      }

      // Tier B (rank 1): scroll + stimulant
      if (normalizedAllowedSources.stimulant && !tooManyResults) {
        const stimStats = solveStimulantResidual(residual, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
        if (stimStats) {
          addResult({
            scrolls: ss.scrolls,
            stimulant: { stats: stimStats },
            gems: [],
            itemLevelUp: ilc,
            priorityRank: 1,
          });
        }
      }

      // Tier C (rank 2): scroll + gems
      if (normalizedAllowedSources.gems && !tooManyResults) {
        for (const gc of gemContributions) {
          if (tooManyResults) break;
          if (isExactVector(gc.stats, residual, targetKeys)) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: null,
              gems: gc.gems,
              itemLevelUp: ilc,
              priorityRank: 2,
            });
          }
        }
      }

      // Tier D (rank 4): scroll + stimulant + gems
      if (normalizedAllowedSources.stimulant && normalizedAllowedSources.gems && !tooManyResults) {
        for (const gc of gemContributions) {
          if (tooManyResults) break;
          const afterGems = subtractVectors(residual, gc.stats, targetKeys);
          const stimStats = solveStimulantResidual(afterGems, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
          if (stimStats) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: { stats: stimStats },
              gems: gc.gems,
              itemLevelUp: ilc,
              priorityRank: 4,
            });
          }
        }
      }
    }
  }
} else {
  // ── Existing 8-tier loop (unchanged) ──────────────────────
  for (const ss of effectiveScrollStates) {
    const residual = subtractVectors(effectiveTargetDeltas, ss.stats, targetKeys);

    // Tier 0: scroll-only
    if (normalizedAllowedSources.scrolls
        && isExactVector(ss.stats, effectiveTargetDeltas, targetKeys)) {
      addResult({
        scrolls: ss.scrolls,
        stimulant: null,
        gems: [],
        itemLevelUp: null,
        priorityRank: 0,
      });
    }

    // Tier 1: scroll + stimulant
    if (normalizedAllowedSources.stimulant && !tooManyResults) {
      const stimStats = solveStimulantResidual(residual, targetKeys, { ...stimulantOpts, bounds: stimulantStatBounds });
      if (stimStats) {
        addResult({
          scrolls: ss.scrolls,
          stimulant: { stats: stimStats },
          gems: [],
          itemLevelUp: null,
          priorityRank: 1,
        });
      }
    }

    // Tier 2: scroll + gems
    if (normalizedAllowedSources.gems && !tooManyResults) {
      for (const gc of gemContributions) {
        if (tooManyResults) break;
        if (isExactVector(gc.stats, residual, targetKeys)) {
          addResult({
            scrolls: ss.scrolls,
            stimulant: null,
            gems: gc.gems,
            itemLevelUp: null,
            priorityRank: 2,
          });
        }
      }
    }

    // Tier 3: scroll + itemLevelUp
    if (normalizedAllowedSources.itemLevelUp && !tooManyResults) {
      for (const ilc of itemLevelContributions) {
        if (tooManyResults) break;
        if (isExactVector(ilc.stats, residual, targetKeys)) {
          addResult({
            scrolls: ss.scrolls,
            stimulant: null,
            gems: [],
            itemLevelUp: ilc,
            priorityRank: 3,
          });
        }
      }
    }

    // Tier 4: scroll + stimulant + gems
    if (normalizedAllowedSources.stimulant && normalizedAllowedSources.gems
      && !tooManyResults) {
      for (const gc of gemContributions) {
        if (tooManyResults) break;
        const afterGems = subtractVectors(residual, gc.stats, targetKeys);
        const stimStats = solveStimulantResidual(afterGems, targetKeys, stimulantOpts);
        if (stimStats) {
          addResult({
            scrolls: ss.scrolls,
            stimulant: { stats: stimStats },
            gems: gc.gems,
            itemLevelUp: null,
            priorityRank: 4,
          });
        }
      }
    }

    // Tier 5: scroll + stimulant + itemLevelUp
    if (normalizedAllowedSources.stimulant && normalizedAllowedSources.itemLevelUp
      && !tooManyResults) {
      for (const ilc of itemLevelContributions) {
        if (tooManyResults) break;
        const afterLevel = subtractVectors(residual, ilc.stats, targetKeys);
        const stimStats = solveStimulantResidual(afterLevel, targetKeys, stimulantOpts);
        if (stimStats) {
          addResult({
            scrolls: ss.scrolls,
            stimulant: { stats: stimStats },
            gems: [],
            itemLevelUp: ilc,
            priorityRank: 5,
          });
        }
      }
    }

    // Tier 6: scroll + gems + itemLevelUp
    if (normalizedAllowedSources.gems && normalizedAllowedSources.itemLevelUp
      && !tooManyResults) {
      for (const gc of gemContributions) {
        if (tooManyResults) break;
        for (const ilc of itemLevelContributions) {
          if (tooManyResults) break;
          const combined = addVectors(gc.stats, ilc.stats, targetKeys);
          if (isExactVector(combined, residual, targetKeys)) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: null,
              gems: gc.gems,
              itemLevelUp: ilc,
              priorityRank: 6,
            });
          }
        }
      }
    }

    // Tier 7: scroll + stimulant + gems + itemLevelUp
    if (normalizedAllowedSources.stimulant && normalizedAllowedSources.gems
      && normalizedAllowedSources.itemLevelUp && !tooManyResults) {
      for (const gc of gemContributions) {
        if (tooManyResults) break;
        for (const ilc of itemLevelContributions) {
          if (tooManyResults) break;
          const afterBoth = subtractVectors(residual, addVectors(gc.stats, ilc.stats, targetKeys), targetKeys);
          const stimStats = solveStimulantResidual(afterBoth, targetKeys, stimulantOpts);
          if (stimStats) {
            addResult({
              scrolls: ss.scrolls,
              stimulant: { stats: stimStats },
              gems: gc.gems,
              itemLevelUp: ilc,
              priorityRank: 7,
            });
          }
        }
      }
    }

    if (tooManyResults) break;
  }
}
```

The `else` block is a verbatim copy of the existing loop body — no logic changes.

- [ ] **Step 3: Run tests — identify expected failures**

Run: `node --test tests/deconstruction-engine.test.mjs`
Expected: The test `allowed sources are permitted but not required` will fail because it expects scroll-only strategies when itemLevelUp is enabled. The `finds and prioritizes all single and mixed fallback sources` test may also need review. Note the failures; we fix them in Task 3.

- [ ] **Step 4: Commit**

```bash
git add src/lib/deconstruction/engine.mjs
git commit -m "feat: restructure enumeration with itemLevelUp as base layer outer loop

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Tests — add enforcement tests and fix broken expectations

**Files:**
- Modify: `tests/deconstruction-engine.test.mjs`

- [ ] **Step 1: Add test — every strategy includes itemLevelUp when enabled**

Insert after the `disabled <source> source is absent` loop block (~line 450):

```js
test('when itemLevelUp is enabled, every strategy includes it', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    allowedSources: { scrolls: true, stimulant: true, gems: true, itemLevelUp: true },
  }));

  assert.ok(result.strategies.length > 0, 'should produce strategies');
  for (const s of result.strategies) {
    assert.ok(s.hasItemLevelUp, 'every strategy must include itemLevelUp');
    assert.ok(s.itemLevelUp !== null, 'itemLevelUp payload must be non-null');
    assert.ok(s.sourceTypes.includes('itemLevelUp'), 'sourceTypes must include itemLevelUp');
  }
});
```

- [ ] **Step 2: Add test — disabled itemLevelUp produces no itemLevelUp strategies**

```js
test('when itemLevelUp is disabled, no strategy includes it', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    allowedSources: { scrolls: true, stimulant: true, gems: true, itemLevelUp: false },
  }));

  assert.ok(result.strategies.length > 0, 'should produce strategies');
  for (const s of result.strategies) {
    assert.ok(!s.hasItemLevelUp, 'no strategy should include itemLevelUp');
    assert.equal(s.itemLevelUp, null);
    assert.ok(!s.sourceTypes.includes('itemLevelUp'));
  }
});
```

- [ ] **Step 3: Add test — itemLevelUp with zero scrolls and other sources**

```js
test('itemLevelUp with zero scrolls produces stim and gem combinations', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    targetDeltas: { str: 5 },
    successfulScrollCount: 0,
    allowedSources: { scrolls: false, stimulant: true, gems: true, itemLevelUp: true },
  }));

  assert.ok(result.strategies.length > 0, 'should produce strategies');
  for (const s of result.strategies) {
    assert.ok(s.hasItemLevelUp, 'every strategy must include itemLevelUp');
    assert.equal(s.scrolls.length, 0);
  }
  // Should include at least one stim-only and one gem-only result
  assert.ok(result.strategies.some(s => s.hasStimulant && s.gems.length === 0), 'should have stim-only result');
  assert.ok(result.strategies.some(s => !s.hasStimulant && s.gems.length > 0), 'should have gem-only result');
});
```

- [ ] **Step 4: Fix the `allowed sources are permitted but not required` test (line 420-433)**

Replace it with:

```js
test('allowed sources are permitted with itemLevelUp as base', () => {
  const result = enumerateStrategies(makeAllowedSourcesFixture({
    allowedSources: { scrolls: true, stimulant: true, gems: true, itemLevelUp: true },
  }));

  // Every strategy must include itemLevelUp when enabled
  assert.ok(result.strategies.length > 0, 'should produce strategies');
  assert.ok(result.strategies.every(s => s.hasItemLevelUp), 'every strategy must include itemLevelUp');

  // Should find scroll+stim+levelUp combination
  assert.ok(result.strategies.some(s =>
    s.scrolls.length === 1 && s.scrolls[0].id === 7101
    && s.hasStimulant && s.stimulant.stats.str > 0
    && s.hasItemLevelUp), 'should find scroll+stim+levelUp');

  // Should find scroll+gem+levelUp combination
  assert.ok(result.strategies.some(s =>
    s.scrolls.length === 1 && s.gems.length > 0 && s.hasItemLevelUp),
    'should find scroll+gem+levelUp');
});
```

- [ ] **Step 5: Run engine tests — all pass**

Run: `node --test tests/deconstruction-engine.test.mjs`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add tests/deconstruction-engine.test.mjs
git commit -m "test: enforce itemLevelUp presence in every strategy, fix expectations

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: UI — remove itemLevelUp primary filter chip

**Files:**
- Modify: `src/pages/deconstruction.astro`

- [ ] **Step 1: Remove the itemLevelUp entry from FILTER_DEFS**

In the `displayResults` function (around line 1597), change:

```js
const FILTER_DEFS = [
  { source: null, label: '전체' },
  { source: 'scrolls', label: '주문서' },
  { source: 'stimulant', label: '촉진제/추옵' },
  { source: 'gems', label: '보석 (메이커)' },
];
```

Removing `{ source: 'itemLevelUp', label: '레벨업' }`.

- [ ] **Step 2: Run UI contract tests to confirm expected failure**

Run: `node --test tests/deconstruction-ui-contract.test.mjs`
Expected: One test fails — the assertion expecting the itemLevelUp filter chip. We update it next.

- [ ] **Step 3: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: remove redundant 레벨업 primary filter chip from results

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Tests — update UI contract for removed filter chip

**Files:**
- Modify: `tests/deconstruction-ui-contract.test.mjs`

- [ ] **Step 1: Change the itemLevelUp filter chip assertion**

Replace line 364:
```js
assert.match(displaySource, /\{ source: 'itemLevelUp', label: '레벨업' \}/);
```
With:
```js
assert.doesNotMatch(displaySource, /\{ source: 'itemLevelUp', label: '레벨업' \}/);
```

- [ ] **Step 2: Run UI contract tests**

Run: `node --test tests/deconstruction-ui-contract.test.mjs`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add tests/deconstruction-ui-contract.test.mjs
git commit -m "test: update UI contract for removed 레벨업 filter chip

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Full test suite verification

- [ ] **Step 1: Run all deconstruction tests**

```bash
node --test tests/deconstruction-engine.test.mjs tests/deconstruction-source-contributions.test.mjs tests/deconstruction-ui-contract.test.mjs
```

Expected: All tests pass.

- [ ] **Step 2: Fix any remaining failures inline, then commit if needed**

```bash
git add -A
git commit -m "test: final test adjustments for itemLevelUp base layer

Co-Authored-By: Claude <noreply@anthropic.com>"
```
