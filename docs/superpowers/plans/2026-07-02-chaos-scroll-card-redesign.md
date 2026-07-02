# Chaos Scroll Card Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clean up the chaos scroll card in the result filter panel — remove misleading stat subtitle, vertically center the name, and ensure per-stat delta sliders show target-relevant stats with the vertical stack layout.

**Architecture:** Two-file change. CSS in `deconstruction.astro` adjusts the text block layout for chaos cards. JS in `resultFilterController.mjs` removes the stat subtitle generation for chaos scrolls. The existing chaos delta filter plumbing (`chaosDeltaRanges`, sliders, `applyFilters`) stays intact — only the render logic changes.

**Tech Stack:** Vanilla JS (DOM manipulation), Astro (scoped CSS with `:global()`), no new dependencies.

---

## File Structure

| File | Role | Change |
|------|------|--------|
| `src/pages/deconstruction.astro` | CSS for scroll card rows | Adjust `.decon-secondary-scroll-text` for single-line vertical centering on chaos cards |
| `src/lib/deconstruction/resultFilterController.mjs` | Renders secondary filter panels | Remove stat subtitle for chaos scrolls in `renderScrollPanel()` |

---

### Task 1: Remove stat subtitle from chaos scroll card (JS)

**Files:**
- Modify: `src/lib/deconstruction/resultFilterController.mjs:222-233`

The chaos scroll card's left side currently renders a two-line text block (name + stat subtitle). For chaos scrolls, the stat subtitle is misleading ("변화 없음" or empty) because all base stats are 0. Remove the stat subtitle element for chaos scrolls so the text block is a single line.

- [ ] **Step 1: Read the current text block creation code**

The text block is built at lines 222-233. Currently for ALL scrolls (regular and chaos), it creates both a `name` span and a `statLine` span inside `textBlock`:

```javascript
// lines 222-233 (current)
const textBlock = document.createElement('span');
textBlock.className = 'decon-secondary-scroll-text';

const name = document.createElement('span');
name.className = 'decon-secondary-scroll-name';
name.textContent = option.label;

const statLine = document.createElement('span');
statLine.className = 'decon-secondary-scroll-stat';
statLine.textContent = option.stats ? formatScrollStatLine({ stats: option.stats }) : '';

textBlock.append(name, statLine);
```

- [ ] **Step 2: Conditionally skip statLine for chaos scrolls**

Replace lines 222-233 with:

```javascript
const textBlock = document.createElement('span');
textBlock.className = 'decon-secondary-scroll-text';

const name = document.createElement('span');
name.className = 'decon-secondary-scroll-name';
name.textContent = option.label;

if (!isChaos) {
  const statLine = document.createElement('span');
  statLine.className = 'decon-secondary-scroll-stat';
  statLine.textContent = option.stats ? formatScrollStatLine({ stats: option.stats }) : '';
  textBlock.append(name, statLine);
} else {
  textBlock.append(name);
}
```

This keeps the subtitle for regular scroll cards (which have meaningful stat values) and removes it for chaos scrolls (where stats are all 0).

- [ ] **Step 3: Verify the change compiles/runs**

Run: `cd /Users/andykim/Desktop/project/ScrollBluePill && npx astro build --silent 2>&1 | tail -5`
Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/deconstruction/resultFilterController.mjs
git commit -m "fix: remove misleading stat subtitle from chaos scroll card

Chaos scroll base stats are all zero, so the stat line showed
'변화 없음' (no change) which is misleading. Chaos scrolls
produce random deltas; there is no fixed stat to display.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Vertically center single-line text in chaos scroll card (CSS)

**Files:**
- Modify: `src/pages/deconstruction.astro` — `.decon-secondary-scroll-text` and `.decon-secondary-scroll-info`

The `.decon-secondary-scroll-text` currently uses `flex-direction: column` with a `gap: 1px` to stack name above stat subtitle. For chaos cards (now single-line), the name should be vertically centered alongside the icon.

- [ ] **Step 1: Read current CSS for scroll text and info**

Current CSS at lines 4230-4318:

```css
:global(.decon-secondary-scroll-info) {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 0 0 auto;
}

:global(.decon-secondary-scroll-text) {
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: 1px;
}
```

- [ ] **Step 2: No CSS changes needed**

The existing `.decon-secondary-scroll-info` already has `align-items: center` and `.decon-secondary-scroll-text` is a flex child inside it. When `textBlock` contains only a single `name` span (no `statLine`), the flex column collapses to the height of one line of text. The parent's `align-items: center` vertically centers it alongside the icon automatically.

**No CSS change is required.** The JS change from Task 1 (removing the `statLine` element for chaos scrolls) is sufficient — the existing flex layout handles the centering.

- [ ] **Step 3: Verify with a visual check**

Run the dev server and confirm:
1. Open the deconstruction page
2. Select an item, set target stats, and run analysis
3. Open the "주문서" secondary filter panel
4. The chaos scroll card (4th row) should show icon + "혼돈의 주문서" vertically centered, no stat subtitle

- [ ] **Step 4: Commit**

```bash
git commit --allow-empty -m "docs: note no CSS changes needed for chaos card centering

The existing flex layout (align-items: center on .decon-secondary-scroll-info)
already vertically centers single-line text blocks.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Restrict chaos stat slider rows to target-relevant stats (JS)

**Files:**
- Modify: `src/lib/deconstruction/resultFilterController.mjs:162-182` (chaosStatRanges computation)
- Verify: No change needed — already target-restricted by the engine.

The engine (`engine.mjs:53`) already filters chaos delta generation to `targetKeys`. This means strategies only contain chaos deltas for target-relevant stats, and `chaosStatRanges` in the filter controller naturally contains only those keys. **No code change is required.**

- [ ] **Step 1: Verify engine restricts chaos deltas to targetKeys**

Existing code at `src/lib/deconstruction/engine.mjs:53`:
```javascript
const scrollPoolKeys = Object.keys(stats).filter((k) => targetKeys.includes(k));
```

This restricts `generateChaosDeltas` to only `targetKeys`. Chaos scrolls in strategies will only have non-zero deltas for target-relevant stats.

Existing code at `resultFilterController.mjs:162-182` builds `chaosStatRanges` by iterating `Object.entries(s.stats ?? {})` for chaos scrolls in strategies. Since the engine only produces deltas for `targetKeys`, these ranges are already target-restricted.

- [ ] **Step 2: No code change needed — document the verification**

```bash
git commit --allow-empty -m "docs: verify chaos stat rows already restricted to targetKeys

The engine (engine.mjs:53) filters chaos delta generation to targetKeys,
so chaosStatRanges in the filter controller naturally contains only
target-relevant stats. No code change required.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Slider default range — full observed range (JS)

**Files:**
- Verify: `src/lib/deconstruction/resultFilterController.mjs:335-336`

Verify that when the chaos scroll card is first rendered, the slider handles start at the extremities of the observed range (no filtering applied).

- [ ] **Step 1: Read the current default initialization**

Lines 335-336:
```javascript
const existing = persisted.get(statKey);
const curMin = existing ? existing.min : fullRange.min;
const curMax = existing ? existing.max : fullRange.max;
```

When no user adjustment has been made (`existing` is null), `curMin` = `fullRange.min` and `curMax` = `fullRange.max` — both handles at the extremities. This is the correct default: no filtering applied.

- [ ] **Step 2: No code change needed**

```bash
git commit --allow-empty -m "docs: verify chaos slider defaults to full observed range

The existing logic uses fullRange.min and fullRange.max as defaults
when no user adjustment has been stored. No code change required.

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Start the dev server**

```bash
cd /Users/andykim/Desktop/project/ScrollBluePill && npx astro dev --port 4321 &
sleep 5
```

- [ ] **Step 2: Open and test manually**

1. Navigate to `http://localhost:4321/deconstruction`
2. Search for and select a glove item (e.g., "노가다 목장갑")
3. Add target stats (e.g., STR, DEX, 공격력)
4. Enable chaos scrolls in the rate chips
5. Click "분석 시작"
6. Open the "주문서" secondary filter panel by clicking the chip
7. Verify: Chaos scroll card shows icon + "혼돈의 주문서" — no stat subtitle, name vertically centered
8. Verify: Per-stat delta sliders appear for each target stat (STR, DEX, 공격력)
9. Verify: Dragging a slider handle filters the strategy list
10. Verify: Deselecting the chaos card dims the sliders and hides chaos strategies
11. Verify: Re-selecting the card restores sliders and strategies

- [ ] **Step 3: Commit final verification**

```bash
git add -A
git commit -m "verify: chaos scroll card redesign end-to-end

- No stat subtitle on chaos card ✓
- Name vertically centered with icon ✓
- Per-stat delta sliders for target-relevant stats ✓
- Filter mode works (drag hides non-matching strategies) ✓
- Deselect dims sliders ✓

Co-Authored-By: Claude <noreply@anthropic.com>"
```
