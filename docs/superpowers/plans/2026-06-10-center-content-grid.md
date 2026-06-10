# Center Content Grid Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Constrain the left panel in the two-column grid to max 550px and center both columns within the 1180px container.

**Architecture:** Single CSS rule change in `BaseLayout.astro` — swap `1fr` for `minmax(0, 550px)` and add `justify-content: center` to `.grid.two`. No new files, no new classes, no structural changes.

**Tech Stack:** Astro, CSS Grid

---

### Task 1: Constrain and center the `.grid.two` columns

**Files:**
- Modify: `src/layouts/BaseLayout.astro:319`

- [ ] **Step 1: Apply the CSS change**

In `src/layouts/BaseLayout.astro`, replace the `.grid.two` rule:

```css
/* Before (line 319) */
.grid.two {
    grid-template-columns: 1fr 315px;
}

/* After */
.grid.two {
    grid-template-columns: minmax(0, 550px) 315px;
    justify-content: center;
}
```

- [ ] **Step 2: Build and verify no regressions**

```bash
npm run build
```

Expected: Build succeeds with no errors. The output CSS should contain the updated `.grid.two` rule.

- [ ] **Step 3: Verify the built CSS has the change**

```bash
grep -r "grid.two" dist/_astro/*.css
```

Expected: Output shows `grid-template-columns:minmax(0,550px) 315px;justify-content:center` (minified).

- [ ] **Step 4: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: constrain left panel width and center two-column grid

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```
