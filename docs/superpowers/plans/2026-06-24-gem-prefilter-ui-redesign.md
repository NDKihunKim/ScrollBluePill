# Gem Pre-Filter UI Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the gem pre-filter category cards as horizontal rows and soften the accordion left border, matching the results panel gem filter aesthetic.

**Architecture:** CSS-only change in `src/pages/deconstruction.astro` scoped `<style>` block. Rewrites `.decon-gem-category` and `.decon-gem-grid` to match `.decon-secondary-gem-category`/`.decon-secondary-gem-grid` patterns. Changes `.decon-source-sub` border color from `#3366ff` to `var(--line)`.

**Tech Stack:** Astro scoped CSS

---

### Task 1: Restyle gem pre-filter CSS

**Files:**
- Modify: `src/pages/deconstruction.astro` — scoped `<style>` block

- [ ] **Step 1: Rewrite `.decon-gem-category` to horizontal row layout**

Read lines 3513-3532. Replace the `.decon-gem-category` rule block:

```css
.decon-gem-category {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 5px 7px;
  border: 1px solid var(--line);
  border-radius: 6px;
  font-size: 0.72rem;
  cursor: pointer;
  background: var(--panel);
  color: var(--ink);
  transition: background 0.15s ease;
}

.decon-gem-category:hover {
  background: color-mix(in srgb, var(--line) 30%, var(--panel));
}

.decon-gem-category img {
  width: 22px;
  height: 22px;
  object-fit: contain;
  image-rendering: pixelated;
  border-radius: 3px;
}
```

Changes from current:
- `flex-direction: column` removed → default `row`
- `align-items` changed from `center` (was centering stacked items) → `center` (vertically centers icon + text in row)
- `padding: 8px 6px` → `5px 7px` (compact)
- `font-size: 0.74rem` → `0.72rem`
- `font-weight: 600` removed (normal weight)
- `gap: 3px` → `5px`
- Icon: `24px` → `22px`, `border-radius: 2px` → `3px`
- Hover: `border-color: var(--green)` removed — only background shift remains
- Added `color: var(--ink)` explicitly (was inherited before, make it explicit like the results panel)

- [ ] **Step 2: Widen `.decon-gem-grid` minimum**

Read line 3507-3511. Change:

```css
.decon-gem-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(115px, 1fr));
  gap: 4px;
}
```

Only change: `minmax(80px, ...)` → `minmax(115px, ...)`

- [ ] **Step 3: Soften accordion left border**

Read line 3133. Change:

```css
  border-left: 0 solid var(--line);
```

From: `border-left: 0 solid #3366ff`

- [ ] **Step 4: Build and verify**

```bash
cd /Users/andykim/Desktop/project/ScrollBluePill && npm run build
```

Expected: Build succeeds, 11 pages, no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "style: redesign gem pre-filter cards as horizontal rows, soften accordion border"
```
