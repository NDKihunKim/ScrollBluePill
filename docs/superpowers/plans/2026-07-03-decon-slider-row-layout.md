# Regular Scroll Slider Row Layout — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the regular scroll slider area in the deconstruction secondary filters panel from stacked (column) to inline row layout — label+values on the left, dual-range slider on the right, vertically centered.

**Architecture:** CSS-only change. Three existing rules in `deconstruction.astro` are modified. No JS changes, no DOM restructuring. The `.decon-secondary-scroll-slider-wrap` flex container switches from `column` to `row`, the header is allowed to shrink, and the `.dual-range` slider fills remaining space via `flex: 1 1 0`.

**Tech Stack:** Astro, CSS (global scoped styles)

---

### Task 1: Change slider wrap from column to row

**Files:**
- Modify: `src/pages/deconstruction.astro:4238-4247`

- [ ] **Step 1: Replace the `.decon-secondary-scroll-slider-wrap` rule**

Replace the existing rule block at lines 4238–4247:

```css
:global(.decon-secondary-scroll-slider-wrap) {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  flex: 1 1 0;
  min-width: 0;
  padding: 4px 0 10px 0;
}
```

With:

```css
:global(.decon-secondary-scroll-slider-wrap) {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  flex: 1 1 0;
  min-width: 0;
  padding: 4px 0;
}
```

Changes:
- `flex-direction: column` → `flex-direction: row`
- Removed `justify-content: center` (irrelevant in row layout)
- `gap: 0` → `gap: 6px` (spacing between header and slider)
- `padding: 4px 0 10px 0` → `padding: 4px 0` (less bottom padding needed without stacked layout)

- [ ] **Step 2: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "style: switch decon slider wrap to flex row layout"
```

---

### Task 2: Allow slider header to shrink

**Files:**
- Modify: `src/pages/deconstruction.astro:4249-4258`

- [ ] **Step 1: Replace the `.decon-secondary-scroll-slider-header` rule**

Replace the existing rule block at lines 4249–4258:

```css
:global(.decon-secondary-scroll-slider-header) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: calc(100% - 18px);
  font-size: 0.7rem;
  color: var(--muted);
  line-height: 1.15;
}
```

With:

```css
:global(.decon-secondary-scroll-slider-header) {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  white-space: nowrap;
  font-size: 0.7rem;
  color: var(--muted);
  line-height: 1.15;
}
```

Changes:
- Removed `justify-content: center` (no longer needed)
- Removed `width: calc(100% - 18px)` (header should size to content, not fill row)
- Added `flex-shrink: 1` (allows compression when space is tight)
- Added `min-width: 0` (allows flex item to shrink below content size)
- Added `overflow: hidden` (clips content that overflows)
- Added `white-space: nowrap` (prevents label/values from wrapping to multiple lines)

- [ ] **Step 2: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "style: allow decon slider header to shrink in row layout"
```

---

### Task 3: Make dual-range slider fill remaining row space

**Files:**
- Modify: `src/pages/deconstruction.astro:4260-4263`

- [ ] **Step 1: Replace the `.decon-secondary-scroll-slider-wrap .dual-range` rule**

Replace the existing rule block at lines 4260–4263:

```css
:global(.decon-secondary-scroll-slider-wrap .dual-range) {
  --dh: 14px;
  margin-top: -4px;
}
```

With:

```css
:global(.decon-secondary-scroll-slider-wrap .dual-range) {
  --dh: 14px;
  flex: 1 1 0;
  min-width: 0;
}
```

Changes:
- Removed `margin-top: -4px` (was compensating for column stacking, no longer needed)
- Added `flex: 1 1 0` (grows to fill remaining space, no basis so it shares evenly)
- Added `min-width: 0` (allows slider to shrink below its intrinsic size)

- [ ] **Step 2: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "style: make decon dual-range slider fill remaining row space"
```

---

### Task 4: Verification

- [ ] **Step 1: Check for syntax errors**

```bash
cd /Users/andykim/Desktop/project/ScrollBluePill && npx astro check 2>&1 || true
```

Expected: No CSS parse errors. TypeScript errors unrelated to CSS changes are acceptable.

- [ ] **Step 2: Verify the final CSS block is coherent**

Read lines 4238–4267 of `src/pages/deconstruction.astro` and confirm all three rules read naturally together — no conflicting properties, no orphaned references to removed values.

- [ ] **Step 3: Manual browser verification**

Start the dev server and:
1. Open the deconstruction page
2. Search for an item that has regular scroll results
3. Select a regular scroll in the result list
4. Confirm the count label + range values appear on the **same row** as the dual-range slider
5. Drag both slider thumbs — verify range text updates correctly
6. Narrow the browser window — verify the label/values shrink and the slider still functions

- [ ] **Step 4: Commit any verification fixes**

```bash
git add src/pages/deconstruction.astro
git commit -m "chore: verification — slider row layout confirmed"
```
