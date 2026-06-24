# Deconstruction Stat Editor Grouping & Label Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add group sub-titles ("기본 스탯", "아이템 정보") with separator lines, and equalize label widths per-group so stepper controls align vertically in the deconstruction stat editor.

**Architecture:** Static HTML sub-titles and separators are inserted into `data-decon-edit-content`. A shared `equalizeGroupLabels(container, labelSelector)` utility measures rendered label widths via `getBoundingClientRect()` and sets `minWidth` to the group max. Calls are wired into the existing lifecycle functions (`rebuildStatEditor`, `renderDeconSlotState`, `renderDeconItemLevel`, `activateDeconEditPanel`).

**Tech Stack:** Astro `.astro` SFC (HTML + vanilla JS + scoped/unscoped CSS)

---

### Task 1: Add CSS for group sub-title and separator

**Files:**
- Modify: `src/pages/deconstruction.astro` — scoped `<style>` block

- [ ] **Step 1: Add `.decon-stat-group-title` class**

Insert after the `.decon-stat-editor` rule block (after line 2703):

```css
.decon-stat-group-title {
  margin: 0 0 2px;
  color: var(--muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.decon-stat-group-title[hidden] {
  display: none;
}
```

- [ ] **Step 2: Add `.decon-stat-group-sep` class**

Insert after the group-title rule:

```css
.decon-stat-group-sep {
  width: 100%;
  height: 1px;
  margin: 8px 0;
  background: var(--line);
  border: 0;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "style: add decon stat group title and separator classes"
```

---

### Task 2: Insert sub-titles and separators into the HTML template

**Files:**
- Modify: `src/pages/deconstruction.astro:196-229`

- [ ] **Step 1: Rewrite the `data-decon-edit-content` block**

Replace lines 196–229 (the entire `data-decon-edit-content` div) with:

```astro
          <div data-decon-edit-content hidden>
            <p class="decon-stat-group-title">기본 스탯</p>
            <div class="decon-stat-editor" data-decon-stat-editor></div>
            <hr class="decon-stat-group-sep" data-decon-basic-stats-sep hidden />
            <p class="decon-stat-group-title" data-decon-item-info-title hidden>아이템 정보</p>
            <div class="chaos-stat-row decon-success-row" data-decon-success-row>
              <span class="chaos-stat-label">주문서 성공 횟수</span>
              <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-success-min>MIN</button>
              <button type="button" class="chaos-stepper-btn" data-decon-success-dec>−</button>
              <span class="chaos-stepper-value" data-decon-success-value>0</span>
              <button type="button" class="chaos-stepper-btn" data-decon-success-inc>+</button>
              <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-success-max>MAX</button>
            </div>
            <div class="chaos-stat-row decon-slot-row">
              <span class="chaos-stat-label">남은 슬롯</span>
              <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-slot-min>MIN</button>
              <button type="button" class="chaos-stepper-btn" data-decon-slot-dec>−</button>
              <span class="chaos-stepper-value" data-decon-slot-value>7</span>
              <button type="button" class="chaos-stepper-btn" data-decon-slot-inc>+</button>
              <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-slot-max>MAX</button>
            </div>
            <div class="chaos-stat-row decon-level-row" data-decon-level-row hidden>
              <span class="chaos-stat-label">아이템 레벨</span>
              <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-level-min>MIN</button>
              <button type="button" class="chaos-stepper-btn" data-decon-level-dec>−</button>
              <span class="chaos-stepper-value" data-decon-level-value>1</span>
              <button type="button" class="chaos-stepper-btn" data-decon-level-inc>+</button>
              <button type="button" class="chaos-stepper-btn chaos-stepper-btn--max" data-decon-level-max>MAX</button>
            </div>
            <hr class="decon-stat-group-sep" data-decon-item-info-sep hidden />
            <div class="decon-add-stat-area">
              <button type="button" class="decon-add-stat-toggle" data-decon-add-stat-toggle>
                + 스탯 추가
              </button>
              <div class="decon-add-stat-list" data-decon-add-stat-list hidden>
              </div>
            </div>
          </div>
```

Changes from original:
- Added `<p class="decon-stat-group-title">기본 스탯</p>` before `decon-stat-editor`
- Added `<hr class="decon-stat-group-sep" data-decon-basic-stats-sep hidden />` after `decon-stat-editor`
- Added `<p class="decon-stat-group-title" data-decon-item-info-title hidden>아이템 정보</p>` before the fixed rows
- Added `<hr class="decon-stat-group-sep" data-decon-item-info-sep hidden />` after the level row, before the add-stat area

- [ ] **Step 2: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: add group sub-titles and separators to decon stat editor"
```

---

### Task 3: Add DOM refs and the `equalizeGroupLabels` utility

**Files:**
- Modify: `src/pages/deconstruction.astro` — `<script>` block

- [ ] **Step 1: Add DOM refs for the new elements**

Insert after the `deconAddStatList` ref (after line 403):

```js
const deconBasicStatsSep = document.querySelector('[data-decon-basic-stats-sep]');
const deconItemInfoTitle = document.querySelector('[data-decon-item-info-title]');
const deconItemInfoSep = document.querySelector('[data-decon-item-info-sep]');
```

- [ ] **Step 2: Add the `equalizeGroupLabels` function**

Insert before the `rebuildStatEditor` function (before line 852). The exact insertion point is after the `STAT_ORDER` constant (line ~850):

```js
const equalizeGroupLabels = (container, labelSelector) => {
  if (!(container instanceof HTMLElement)) return;
  const labels = container.querySelectorAll(labelSelector);
  if (labels.length === 0) return;

  // Reset all labels to auto so we measure natural widths
  for (const label of labels) {
    if (label instanceof HTMLElement) {
      label.style.minWidth = '';
    }
  }

  // Measure
  let maxWidth = 0;
  for (const label of labels) {
    const w = label.getBoundingClientRect().width;
    if (w > maxWidth) maxWidth = w;
  }

  // Apply
  const px = Math.ceil(maxWidth) + 'px';
  for (const label of labels) {
    if (label instanceof HTMLElement) {
      label.style.minWidth = px;
    }
  }
};
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: add equalizeGroupLabels utility and DOM refs for group elements"
```

---

### Task 4: Wire `equalizeGroupLabels` calls into lifecycle functions

**Files:**
- Modify: `src/pages/deconstruction.astro` — `<script>` block

- [ ] **Step 1: Call from `rebuildStatEditor` for the 기본 스탯 group**

At the end of `rebuildStatEditor` (after line 932 `deconStatEditor.append(row)`), but before `populateAddStatList()`, add the measurement call. Insert after the `}` closing the `for` loop and before `populateAddStatList()`:

In `rebuildStatEditor`, after the `for` loop that builds rows (after line 932), insert:

```js
  // Equalize label widths in the 기본 스탯 group
  equalizeGroupLabels(deconStatEditor, '.chaos-stat-label');
```

Also, unhide the 기본 스탯 separator at the end of `rebuildStatEditor`. After the `equalizeGroupLabels` call:

```js
  if (deconBasicStatsSep instanceof HTMLElement) deconBasicStatsSep.hidden = false;
```

- [ ] **Step 2: Call from `renderDeconSlotState` for the 아이템 정보 group**

At the end of `renderDeconSlotState` (after line 1147), insert:

```js
  equalizeGroupLabels(deconEditContent, '.decon-success-row > .chaos-stat-label, .decon-slot-row > .chaos-stat-label, .decon-level-row:not([hidden]) > .chaos-stat-label');
```

And unhide the 아이템 정보 elements:

```js
  if (deconItemInfoTitle instanceof HTMLElement) deconItemInfoTitle.hidden = false;
  if (deconItemInfoSep instanceof HTMLElement) deconItemInfoSep.hidden = false;
```

- [ ] **Step 3: Call from `renderDeconItemLevel` for the 아이템 정보 group**

At the end of `renderDeconItemLevel` (after line 1165), insert the same measurement call as step 2:

```js
  equalizeGroupLabels(deconEditContent, '.decon-success-row > .chaos-stat-label, .decon-slot-row > .chaos-stat-label, .decon-level-row:not([hidden]) > .chaos-stat-label');
```

- [ ] **Step 4: Unhide elements in `activateDeconEditPanel`**

In `activateDeconEditPanel`, after `deconEditContent.hidden = false;` (line ~1488), add:

```js
  if (deconItemInfoTitle instanceof HTMLElement) deconItemInfoTitle.hidden = false;
  if (deconItemInfoSep instanceof HTMLElement) deconItemInfoSep.hidden = false;
```

(Avoid unhiding `deconBasicStatsSep` here — `rebuildStatEditor` handles that since the editor is rebuilt on activation.)

- [ ] **Step 5: Update the "기본 스탯" separator visibility toggle**

The separator should be shown/hidden with the editor content. When `clearDeconCalculationState` or the reset button clears state and the edit panel re-activates, `rebuildStatEditor` runs again and re-unhides the separator. No extra changes needed — the existing flow covers it.

- [ ] **Step 6: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: wire equalizeGroupLabels into decon lifecycle functions"
```

---

### Task 5: Verify

**Files:** none (manual verification)

- [ ] **Step 1: Build the project**

```bash
cd /Users/andykim/Desktop/project/ScrollBluePill && npm run build
```

Expected: Build succeeds with no errors.

- [ ] **Step 2: Start dev server and visually verify**

```bash
cd /Users/andykim/Desktop/project/ScrollBluePill && npm run dev
```

Open the deconstruction page in a browser and:

1. Select an item with stats (e.g., any weapon or armor with multiple base stats)
2. Verify **"기본 스탯"** sub-title appears above the stat rows
3. Verify a separator line appears below the last stat row
4. Verify **"아이템 정보"** sub-title appears above the fixed rows
5. Verify a separator line appears below 아이템 레벨 (or 남은 슬롯 if level row is hidden)
6. Verify all stepper buttons (−, +, MIN, MAX, value input) are vertically aligned within each group
7. Select an item that supports level-ups — verify **"아이템 레벨"** row appears and its stepper aligns with the group
8. Select an item without level-up support — verify the row stays hidden and alignment still works
9. Add a stat via "+ 스탯 추가" — verify new row label aligns within the 기본 스탯 group
10. Click reset (초기화) — verify the panel resets properly

- [ ] **Step 3: Commit any fixes if needed**

```bash
git add src/pages/deconstruction.astro
git commit -m "fix: adjustments from visual verification"
```
