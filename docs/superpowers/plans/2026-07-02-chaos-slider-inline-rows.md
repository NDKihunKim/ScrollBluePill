# Chaos Slider Inline Rows — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Flatten each chaos stat row to a single flex line: label text (with range values) + dual-range slider, removing the header wrapper that forces line wrapping.

**Architecture:** One JS block rewrite in `resultFilterController.mjs` — flatten the `header` + `dualRange` two-child structure into `label` + `dualRange` as direct siblings. No CSS changes. Existing `.decon-secondary-scroll-chaos-stat-row` flex layout handles inline alignment.

**Tech Stack:** Vanilla JS DOM manipulation, Astro.

---

### Task 1: Flatten chaos stat row to inline layout

**Files:**
- Modify: `src/lib/deconstruction/resultFilterController.mjs:329-391`

- [ ] **Step 1: Replace the chaos stat row rendering block**

Replace lines 329-391 (the chaos stat loop body) with the flattened version:

```javascript
for (const [statKey, fullRange] of statRanges) {
  const existing = persisted.get(statKey);
  const curMin = existing ? existing.min : fullRange.min;
  const curMax = existing ? existing.max : fullRange.max;

  const rowS = document.createElement('span');
  rowS.className = 'decon-secondary-scroll-chaos-stat-row';

  const label = document.createElement('span');
  label.className = 'decon-secondary-stimulant-stat';
  const formatLabel = (mn, mx) =>
    `${statLabelByKey[statKey] ?? statKey} ${mn}~${mx}`;
  label.textContent = formatLabel(curMin, curMax);

  const minSlider = document.createElement('input');
  minSlider.type = 'range';
  minSlider.className = 'decon-secondary-stimulant-slider';
  minSlider.min = fullRange.min;
  minSlider.max = fullRange.max;
  minSlider.value = curMin;
  minSlider.disabled = !isSelected;

  const maxSlider = document.createElement('input');
  maxSlider.type = 'range';
  maxSlider.className = 'decon-secondary-stimulant-slider';
  maxSlider.min = fullRange.min;
  maxSlider.max = fullRange.max;
  maxSlider.value = curMax;
  maxSlider.disabled = !isSelected;

  const updateDeltaRange = () => {
    let mn = Number(minSlider.value);
    let mx = Number(maxSlider.value);
    if (mn > mx) [mn, mx] = [mx, mn];
    persisted.set(statKey, { min: mn, max: mx });
    minSlider.value = mn;
    maxSlider.value = mx;
    label.textContent = formatLabel(mn, mx);
    applyFilters();
  };

  minSlider.addEventListener('input', updateDeltaRange);
  maxSlider.addEventListener('input', updateDeltaRange);

  const dualRange = document.createElement('span');
  dualRange.className = 'dual-range';
  dualRange.append(minSlider, maxSlider);

  // Key change: label + dualRange as direct siblings, no header wrapper
  rowS.append(label, dualRange);
  chaosWrap.append(rowS);
}
```

Key differences from current code:
- **Removed** `minVal`, `sep`, `maxVal` spans — values are now in the label text
- **Removed** `header` wrapper span — label and dualRange are direct siblings in `rowS`
- **Added** `formatLabel` helper — combines stat name + range into one string
- **Updated** `updateDeltaRange` — calls `label.textContent = formatLabel(mn, mx)` to update the label text on drag

- [ ] **Step 2: Verify syntax**

Run: `node --check src/lib/deconstruction/resultFilterController.mjs`
Expected: No output (clean parse)

- [ ] **Step 3: Build**

Run: `npx astro build 2>&1 | tail -3`
Expected: `[build] Complete!`

- [ ] **Step 4: Commit**

```bash
git add src/lib/deconstruction/resultFilterController.mjs
git commit -m "feat: inline chaos slider rows — label + slider on one row

Remove the header wrapper span that forced labels and sliders
to stack vertically. Each stat row now renders as a single
flex line: label (with range values) + dual-range slider.
Label text updates dynamically as slider handles are dragged.

Co-Authored-By: Claude <noreply@anthropic.com>"
```
