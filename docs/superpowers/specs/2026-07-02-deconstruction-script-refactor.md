# Deconstruction Page — Script Refactor

**Date:** 2026-07-02
**Status:** Approved

## Problem

`deconstruction.astro` has grown to 5,320 lines. The script section alone is 2,703 lines of inline JS — a monolithic block of 21 loosely-organized sections. Debugging and modifying this file is slow and error-prone.

## Design

Extract 6 module files from the inline script into `src/lib/deconstruction/`. The page file keeps ~400 lines of state, imports, and event wiring. All extracted functions receive state via explicit parameters (no closures over page state).

### Architecture

```
src/pages/deconstruction.astro
├── Template (337 lines) — unchanged
├── Script (~400 lines) — state, imports, event glue
└── Style (2,272 lines) — unchanged

src/lib/deconstruction/
├── domRefs.mjs          (NEW) — all document.querySelector() calls
├── statEditor.mjs        (NEW) — rebuildStatEditor, createStatStepper, add-stat menu
├── itemRenderer.mjs      (NEW) — renderItemCard, renderRequirements, computeGradeColor, item search handlers
├── resultDisplay.mjs     (NEW) — displayResults, handleAnalyzeClick, filter wiring
├── steppers.mjs          (NEW) — slot steppers, level steppers
└── init.mjs              (NEW) — activateDeconPanel, slot helpers, star button, data loading
```

### Module Contracts

**domRefs.mjs** — Exports a single `dom` object with all static DOM element references. Called once at page load.

**statEditor.mjs** — `rebuildStatEditor(state)` receives `{ deconStatEditor, deconStatKeys, selectedItem, deconDeltas, ... }`. Mutates DOM, no return value.

**itemRenderer.mjs** — `renderItemCard(state)`, `handleItemSelect(state, item)`, etc. Each receives state, mutates DOM, returns updated state fragments if state changed.

**resultDisplay.mjs** — `displayResults(state, result, targetDeltas)` and `handleAnalyzeClick(state)`. Receives all needed state, mutates DOM.

**steppers.mjs** — `setupSlotSteppers(state)`, `setupLevelSteppers(state)`. Wire stepper button events, receive state for value display.

**init.mjs** — `activateDeconPanel(state)`, `loadItemIndex()`, `loadScrollData()`. Bootstrap functions, no closure dependencies.

### Safety Rules

1. All extracted functions receive needed state as a single `state` object parameter
2. Functions that change state return `{ ...changes }` — page assigns: `Object.assign(stateVars, returned)`
3. No global variables in extracted modules
4. Each extraction verified by `npx astro build` (must exit 0, 11 pages)
5. Incremental: extract → build → commit → repeat

### Files NOT Changed

- Template HTML (lines 7-343)
- Style CSS (lines 3049-5320)
- Existing `src/lib/deconstruction/*.mjs` (engine, filters, slots, etc.)
- All other pages and components
