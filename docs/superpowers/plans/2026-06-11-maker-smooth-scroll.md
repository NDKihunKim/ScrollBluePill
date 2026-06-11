# Maker Smooth Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Smoothly scroll to the expanded Maker controls when the Maker button enables the Maker area.

**Architecture:** Keep the behavior inside `src/lib/makerPanel.mjs`, where Maker activation already shows the gem area. Add one source contract in `tests/calculator-input-contract.test.mjs` so the scroll behavior remains tied to Maker enablement.

**Tech Stack:** Browser-side ES module, existing Maker panel DOM references, Node `node:test`.

---

### Task 1: Add Failing Smooth Scroll Contract

**Files:**
- Modify: `tests/calculator-input-contract.test.mjs`
- Production file covered by Task 2: `src/lib/makerPanel.mjs`

- [ ] **Step 1: Write the failing test**

Add a test that reads `src/lib/makerPanel.mjs` and asserts Maker enablement calls:

```js
makerGemArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
```

- [ ] **Step 2: Run the focused test**

Run: `node --test --test-name-pattern "maker button smoothly scrolls to expanded maker controls" tests/calculator-input-contract.test.mjs`

Expected: FAIL because the source does not call `scrollIntoView`.

### Task 2: Implement Smooth Scroll

**Files:**
- Modify: `src/lib/makerPanel.mjs`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Add the scroll call**

Inside Maker enablement, immediately after the Maker gem area is shown, call:

```js
makerGemArea.scrollIntoView({ behavior: 'smooth', block: 'start' });
```

- [ ] **Step 2: Run focused verification**

Run:

```bash
node --test --test-name-pattern "maker button smoothly scrolls to expanded maker controls" tests/calculator-input-contract.test.mjs
node --test tests/enhancement-state.test.mjs
npm run build
```

Expected: all commands pass.
