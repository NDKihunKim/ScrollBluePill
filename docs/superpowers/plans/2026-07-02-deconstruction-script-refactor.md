# Deconstruction Script Refactor — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract 6 modules from the 2,703-line inline script in `deconstruction.astro`, reducing page script to ~700 lines of state + event wiring.

**Architecture:** Each module extracts a specific line range from the page script into a new file in `src/lib/deconstruction/`. Functions receive page state via explicit parameters (no closures). DOM refs module exports a single `dom` object. Each extraction verified by `npx astro build`.

**Tech Stack:** Vanilla JS modules (`.mjs`), Astro.

---

## Safety Protocol (applies to ALL tasks)

1. **Read** the source line range before extracting
2. **Create** the new module file with extracted code
3. **Replace** extracted code in page with import + thin wrapper
4. **Build** with `npx astro build` — must exit 0, 11 pages
5. **Commit** before next task

If build fails at any step: STOP, revert, diagnose before continuing.

---

### Task 1: Extract `domRefs.mjs`

**Files:**
- Create: `src/lib/deconstruction/domRefs.mjs`
- Modify: `src/pages/deconstruction.astro` — remove lines 379-487, add import

- [ ] **Step 1: Create the module file**

Read lines 379-487 from `deconstruction.astro`. This block contains all `document.querySelector(...)` calls and DOM ref constants. Extract into:

```javascript
// src/lib/deconstruction/domRefs.mjs
export const dom = {};

const form = document.querySelector('[data-calculator-input]');
dom.form = form;
dom.itemNameSearch = form?.querySelector('[data-item-name-search]');
dom.itemNameInput = form?.querySelector('[data-item-name-input]');
dom.selectedItemIdInput = form?.querySelector('[data-selected-item-id]');
dom.itemSuggestions = form?.querySelector('[data-item-suggestions]');
dom.selectedItemCard = document.querySelector('[data-selected-item-card]');
// ... (all DOM refs from lines 379-487, using dom. prefix)
```

The `toggleSourceSub`, `buildDefaultSlotRanges`, and `guardDeconMutation` helper functions that are embedded in this section: move them to a separate section — `guardDeconMutation` stays in page (it wraps page-level state), `toggleSourceSub` and `buildDefaultSlotRanges` can be exported if needed by other modules, or stay in page if only used locally.

- [ ] **Step 2: Add import to page**

At line 346 (after existing imports), add:
```javascript
import { dom } from '../lib/deconstruction/domRefs.mjs';
```

- [ ] **Step 3: Update references in page**

Replace all `document.querySelector(...)` and `form?.querySelector(...)` in the remaining page code with `dom.xxx` references. Do this systematically:
- `deconEditPanel` → `dom.deconEditPanel`
- `selectedItemCard` → `dom.selectedItemCard`
- etc.

- [ ] **Step 4: Remove lines 379-487 from page**

Delete the extracted DOM ref lines. Keep helper functions that other extracted code still needs.

- [ ] **Step 5: Build and verify**

Run: `npx astro build 2>&1 | tail -5`
Expected: `[build] Complete!` with `11 page(s) built`

- [ ] **Step 6: Commit**

```bash
git add src/lib/deconstruction/domRefs.mjs src/pages/deconstruction.astro
git commit -m "refactor: extract DOM refs from deconstruction.astro

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Extract `itemRenderer.mjs`

**Files:**
- Create: `src/lib/deconstruction/itemRenderer.mjs`
- Modify: `src/pages/deconstruction.astro` — remove lines 669-917, add import

**Sections extracted:**
- Lines 669-723: Requirement/Stat row definitions
- Lines 724-784: Utility functions (copied from expected-value.astro)
- Lines 785-900: `renderItemCard()` and helpers
- Lines 901-917: Item grade color computation

- [ ] **Step 1: Create the module**

Extract these sections into `itemRenderer.mjs`. Export functions that are called from the page:
```javascript
// src/lib/deconstruction/itemRenderer.mjs
import { statLabelByKey } from '../makerData.mjs';
import { buildItemIconUrl } from '../maplestoryIo.mjs';
// ... other needed imports

export function renderItemCard(state) { ... }
export function renderRequirements(state) { ... }
export function computeGradeColor(totalAdded) { ... }
```

The `state` parameter is an object containing `{ selectedItem, deconDeltas, dom, ... }` — whatever the function references from page scope.

- [ ] **Step 2: Add import and wrapper in page**

```javascript
import { renderItemCard, renderRequirements, computeGradeColor } from '../lib/deconstruction/itemRenderer.mjs';
```

Replace the extracted functions in the page with thin wrappers that pass state:
```javascript
const renderDeconItemCard = () => renderItemCard({ selectedItem, deconDeltas, dom });
```

- [ ] **Step 3: Build and verify**

Run: `npx astro build 2>&1 | tail -5`
Expected: `[build] Complete!` with `11 page(s) built`

- [ ] **Step 4: Commit**

---

### Task 3: Extract `statEditor.mjs`

**Files:**
- Create: `src/lib/deconstruction/statEditor.mjs`
- Modify: `src/pages/deconstruction.astro` — remove lines 918-1656, add import

**Sections extracted:**
- Lines 918-1070: `rebuildStatEditor()`, stat stepper creation, label equalization
- Lines 1071-1656: Add-stat menu population, stat row management

- [ ] **Step 1: Create the module**

Export `rebuildStatEditor(state)` and related helpers. The `state` object includes all page-level variables the function accesses: `deconStatEditor`, `deconStatKeys`, `selectedItem`, `deconDeltas`, `deconSlotState`, `dom`, etc.

- [ ] **Step 2: Add import and wrapper**

```javascript
import { rebuildStatEditor } from '../lib/deconstruction/statEditor.mjs';
```

Replace function body with:
```javascript
const rebuildStatEditorWrapped = () => rebuildStatEditor({
  dom, selectedItem, deconDeltas, deconStatKeys, deconSlotState,
  deconAppliedLevelCount, deconLevelUpTotalRanges,
});
const rebuildStatEditor = rebuildStatEditorWrapped;
```

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

---

### Task 4: Extract `resultDisplay.mjs`

**Files:**
- Create: `src/lib/deconstruction/resultDisplay.mjs`
- Modify: `src/pages/deconstruction.astro` — remove lines 2347-2599, add import

**Sections extracted:**
- Lines 2347-2391: `handleAnalyzeClick()`
- Lines 2392-2599: `displayResults()`

- [ ] **Step 1: Create the module**

Export `handleAnalyzeClick(state)` and `displayResults(state, result, targetDeltas)`. These functions call into `resultFilterController`, `enumerateStrategies`, and other already-modularized code. State object includes all page variables they reference.

- [ ] **Step 2: Add import and wrapper**

```javascript
import { handleAnalyzeClick, displayResults } from '../lib/deconstruction/resultDisplay.mjs';
```

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

---

### Task 5: Extract `steppers.mjs`

**Files:**
- Create: `src/lib/deconstruction/steppers.mjs`
- Modify: `src/pages/deconstruction.astro` — remove lines 2744-2845, add import

**Sections extracted:**
- Lines 2744-2777: Slot steppers
- Lines 2778-2837: Level steppers
- Lines 2838-2845: Add-stat accordion toggle

- [ ] **Step 1: Create the module**

Export `setupSlotSteppers(state)` and `setupLevelSteppers(state)`. These wire event listeners on stepper buttons.

- [ ] **Step 2: Add import and wrapper**

```javascript
import { setupSlotSteppers, setupLevelSteppers } from '../lib/deconstruction/steppers.mjs';
```

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

---

### Task 6: Extract `init.mjs`

**Files:**
- Create: `src/lib/deconstruction/init.mjs`
- Modify: `src/pages/deconstruction.astro` — remove lines 1977-2335, add import

**Sections extracted:**
- Lines 1977-2028: `activateDeconPanel()`
- Lines 2029-2335: Save slot helpers, star button click handler

- [ ] **Step 1: Create the module**

Export `activateDeconPanel(state)`, `readSlotDeltas()`, `buildSlotDeltaMap()`.

- [ ] **Step 2: Add import and wrapper**

```javascript
import { activateDeconPanel, readSlotDeltas } from '../lib/deconstruction/init.mjs';
```

- [ ] **Step 3: Build and verify**

- [ ] **Step 4: Commit**

---

### Task 7: Final cleanup pass

- [ ] **Step 1: Check for dead code**

Run: `grep -r "function\|const.*=.*=>" src/pages/deconstruction.astro | wc -l`
Compare before/after — all extracted functions should be gone from the page.

- [ ] **Step 2: Verify imports are clean**

Check that all imports in the page are used and all modules compile:
```bash
for f in src/lib/deconstruction/{domRefs,statEditor,itemRenderer,resultDisplay,steppers,init}.mjs; do
  node --check "$f" && echo "OK: $f"
done
```

- [ ] **Step 3: Final build**

Run: `npx astro build 2>&1 | tail -5`
Expected: `[build] Complete!` with `11 page(s) built`

- [ ] **Step 4: Final commit**

```bash
git add -A && git commit -m "refactor: extract 6 modules from deconstruction.astro script

- domRefs.mjs — all DOM element references
- statEditor.mjs — stat editor building and add-stat menu
- itemRenderer.mjs — item card rendering and search handling
- resultDisplay.mjs — analyze handler and result display
- steppers.mjs — slot and level stepper widgets
- init.mjs — panel activation and slot helpers

Co-Authored-By: Claude <noreply@anthropic.com>"
```
