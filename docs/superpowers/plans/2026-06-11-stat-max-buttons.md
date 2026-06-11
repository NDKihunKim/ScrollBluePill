# Stat Max Buttons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-stat `-5` and `+5` buttons to chaos scroll and 촉진제 stat input rows.

**Architecture:** Keep row construction local to `enhancementPanel.mjs` and `makerPanel.mjs`, matching the existing duplicated chaos/stimulant controls. Reuse the existing `.chaos-stepper-btn` style with a width modifier for the wider max buttons.

**Tech Stack:** Browser-side ES modules, Astro CSS, Node `node:test`.

---

### Task 1: Add Failing Contract

**Files:**
- Modify: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Add source assertions**

Add a focused test that verifies:

```js
minMaxBtn.textContent = '-5';
chaosStepperValues.set(key, -5);
maxBtn.textContent = '+5';
chaosStepperValues.set(key, 5);
stimulantValues.set(key, -STIMULANT_STAT_LIMIT);
stimulantValues.set(key, STIMULANT_STAT_LIMIT);
row.append(label, minMaxBtn, minusBtn, valueDisplay, plusBtn, maxBtn);
```

- [ ] **Step 2: Run the focused test**

Run: `node --test --test-name-pattern "stat input rows expose per-row max delta buttons" tests/calculator-input-contract.test.mjs`

Expected: FAIL because max buttons are not implemented.

### Task 2: Implement Buttons

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`
- Modify: `src/lib/makerPanel.mjs`
- Modify: `src/pages/index.astro`

- [ ] **Step 1: Update chaos rows**

Add `-5` and `+5` buttons around the current `− 0 +` controls in `renderChaosInputPanel`.

- [ ] **Step 2: Update stimulant rows**

Add equivalent buttons in `renderStimulantInputPanel`, using `STIMULANT_STAT_LIMIT`.

- [ ] **Step 3: Add CSS width modifier**

Add `.chaos-stepper-btn--max` so the two-character buttons stay readable.

- [ ] **Step 4: Verify**

Run focused contract, `node --test tests/enhancement-state.test.mjs`, and `npm run build`.
