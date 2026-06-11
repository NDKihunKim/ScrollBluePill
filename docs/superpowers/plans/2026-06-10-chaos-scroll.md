# Chaos Scroll ("혼돈의 주문서 60%") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `"chaos"` behavior type scroll (혼돈의 주문서 60%, ID 2049100) with inline stepper inputs for user-provided stat deltas (-5 to +5 per stat) and an 적용 button.

**Architecture:** A new `behavior_type: "chaos"` on scroll definitions signals that stats come from user input rather than predetermined data. The enhancement panel renders an inline expansion panel when a chaos scroll is clicked, with one stepper row per stat the item currently has. Stepper values live in JS state (a Map). 적용 constructs a stats object and delegates to the existing `applyScroll()`.

**Tech Stack:** Vanilla JS (Astro project, no framework), CSS in Astro `<style>` block.

---

## File Structure

| File | Responsibility |
|------|---------------|
| `src/lib/models.ts` | Type definition — add `"chaos"` to `behaviorType` union |
| `src/lib/scrollState.mjs` | Export `statLabelByKey` for external use |
| `public/data/scroll-overrides.local.json` | **New** — chaos scroll definition, served at runtime |
| `src/lib/enhancementPanel.mjs` | Load overrides, merge into scroll lists, render chaos input panel, stepper logic, 적용 handler |
| `src/pages/index.astro` | CSS for `.chaos-input-panel`, `.chaos-stat-row`, `.chaos-stepper-btn`, `.chaos-stepper-value`, `.chaos-apply-button` |

---

### Task 1: Add "chaos" to behavior type union

**Files:**
- Modify: `src/lib/models.ts:15`

- [ ] **Step 1: Update the ScrollDefinition behaviorType**

```ts
behaviorType: 'fixed' | 'random' | 'chaos' | 'unknown';
```

- [ ] **Step 2: Verify the file is valid TypeScript**

Run: `npx tsc --noEmit src/lib/models.ts`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/models.ts
git commit -m "feat: add chaos behavior type to ScrollDefinition

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Export statLabelByKey from scrollState.mjs

**Files:**
- Modify: `src/lib/scrollState.mjs:1`

The chaos panel needs stat labels to display Korean names for each stat key. Currently `statLabelByKey` is module-private.

- [ ] **Step 1: Export statLabelByKey**

Change line 1 from:
```js
const statLabelByKey = {
```
to:
```js
export const statLabelByKey = {
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scrollState.mjs
git commit -m "feat: export statLabelByKey for chaos scroll UI

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create the chaos scroll override data file

**Files:**
- Create: `public/data/scroll-overrides.local.json`

- [ ] **Step 1: Create the override file**

```json
[
  {
    "id": 2049100,
    "nameKo": "혼돈의 주문서 60%",
    "equipmentKind": "*",
    "behavior_type": "chaos",
    "stats": {}
  }
]
```

- [ ] **Step 2: Verify the file is valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('public/data/scroll-overrides.local.json','utf8')); console.log('valid')"`
Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add public/data/scroll-overrides.local.json
git commit -m "feat: add chaos scroll override data (혼돈의 주문서 60%, 2049100)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Load overrides and merge into scroll lists in enhancementPanel.mjs

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`

This task modifies the data-loading section to fetch overrides and merge chaos scrolls (with `equipmentKind: "*"`) into every equipment kind's scroll list, always at the end.

- [ ] **Step 1: Add import for statLabelByKey at top of file**

Change line 1 from:
```js
import { formatScrollStatLine } from './scrollState.mjs';
```
to:
```js
import { formatScrollStatLine, statLabelByKey } from './scrollState.mjs';
```

- [ ] **Step 2: Replace the fetch block (lines 260-313) to load overrides after main index, merge, and sort chaos to end**

Replace the entire `fetch('/data/scrolls-gms83-ko.json')...` block (lines 260-313) with:

```js
  const sortScrollList = (list) => {
    const STAT_KEY_RANK = {
      weaponAttack: 0,
      magicAttack: 1,
      str: 2,
      dex: 3,
      int: 4,
      luk: 5,
    };

    const getStatPriority = (stats) => {
      const keys = Object.keys(stats ?? {});
      let best = 99;
      for (const key of keys) {
        const rank = STAT_KEY_RANK[key];
        if (rank !== undefined && rank < best) best = rank;
      }
      return best;
    };

    const stemName = (n) => String(n ?? '').replace(/(\d+)%$/, '').trimEnd();

    const percentPattern = /(\d+)%$/;
    const extractPercent = (name) => {
      const match = name?.match(percentPattern);
      return match ? Number(match[1]) : 0;
    };

    // Split chaos and non-chaos; sort non-chaos normally, append chaos at end
    const nonChaos = [];
    const chaos = [];
    for (const s of list) {
      if (s.behavior_type === 'chaos') {
        chaos.push(s);
      } else {
        nonChaos.push(s);
      }
    }

    nonChaos.sort((a, b) =>
      getStatPriority(a.stats) - getStatPriority(b.stats) ||
      stemName(a.nameKo).localeCompare(stemName(b.nameKo), 'ko-KR') ||
      extractPercent(b.nameKo) - extractPercent(a.nameKo),
    );

    // Replace list contents: sorted non-chaos, then chaos at end
    list.length = 0;
    list.push(...nonChaos, ...chaos);
  };

  Promise.all([
    fetch('/data/scrolls-gms83-ko.json').then((r) => {
      if (!r.ok) throw new Error(`Unable to load scroll index: ${r.status}`);
      return r.json();
    }),
    fetch('/data/scroll-overrides.local.json').then((r) => {
      if (!r.ok) {
        // Overrides file is optional — 404 is fine
        return [];
      }
      return r.json();
    }).catch(() => []),
  ])
    .then(([scrolls, overrides]) => {
      scrollIndex = Array.isArray(scrolls) ? scrolls : [];
      const overrideList = Array.isArray(overrides) ? overrides : [];
      scrollsByEquipmentKind = new Map();

      // Build equipment kind lists from main scroll index
      scrollIndex.forEach((scroll) => {
        const kind = scroll.equipmentKind;
        if (!scrollsByEquipmentKind.has(kind)) {
          scrollsByEquipmentKind.set(kind, []);
        }
        scrollsByEquipmentKind.get(kind).push(scroll);
      });

      // Merge wildcard overrides (equipmentKind: "*") into every kind
      const wildcardOverrides = overrideList.filter((s) => s.equipmentKind === '*');
      if (wildcardOverrides.length > 0) {
        const allKinds = [...scrollsByEquipmentKind.keys()];
        allKinds.forEach((kind) => {
          wildcardOverrides.forEach((override) => {
            scrollsByEquipmentKind.get(kind).push({ ...override, equipmentKind: kind });
          });
        });
      }

      // Merge non-wildcard overrides into their specific kind
      overrideList
        .filter((s) => s.equipmentKind !== '*')
        .forEach((override) => {
          const kind = override.equipmentKind;
          if (!scrollsByEquipmentKind.has(kind)) {
            scrollsByEquipmentKind.set(kind, []);
          }
          scrollsByEquipmentKind.get(kind).push(override);
        });

      // Sort each equipment kind's list (chaos always at end)
      for (const list of scrollsByEquipmentKind.values()) {
        sortScrollList(list);
      }
    })
    .catch((error) => {
      console.error(error);
      showEnhancementError('주문서 데이터를 불러오지 못했습니다');
    });
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/enhancementPanel.mjs
git commit -m "feat: load scroll overrides and merge chaos scrolls into all equipment kinds

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Add chaos scroll click handling — inline expansion and stepper state

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`

This task adds chaos-specific state variables and the expand/collapse logic. When a chaos scroll is clicked, it expands inline instead of applying immediately.

- [ ] **Step 1: Add chaos state variables and NON_STAT_KEYS constant**

After the existing `let selectedBaseItem = null;` line (line 42), add:

```js
  // Internal keys that are item metadata, not stats chaos can modify
  const NON_STAT_KEYS = new Set(['upgradeSlots', 'attackSpeed']);

  // Chaos scroll state
  let chaosStepperValues = new Map();   // statKey → number (-5..5)
  let activeChaosScroll = null;          // the chaos scroll definition currently expanded
  let activeChaosOptionEl = null;        // the DOM element of the expanded scroll option
```

- [ ] **Step 2: Add helper function to get current visible stat keys**

After the `hideScrollDetail` function (line 133), add:

```js
  const getCurrentStatKeys = () => {
    if (!selectedBaseItem || !enhancementState) {
      return [];
    }

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    return Object.keys(accumulatedStats)
      .filter((key) => !NON_STAT_KEYS.has(key))
      .filter((key) => Number.isFinite(accumulatedStats[key]));
  };
```

- [ ] **Step 3: Add collapseChaosPanel helper**

After the `getCurrentStatKeys` helper, add:

```js
  const collapseChaosPanel = () => {
    if (activeChaosOptionEl) {
      const existingPanel = activeChaosOptionEl.querySelector('.chaos-input-panel');
      if (existingPanel) {
        existingPanel.remove();
      }
      activeChaosOptionEl = null;
    }
    activeChaosScroll = null;
    chaosStepperValues = new Map();
  };
```

- [ ] **Step 4: Modify renderScrollList to branch on chaos scroll click**

Replace the `option.addEventListener('click', ...)` handler inside `renderScrollList` (lines 178-191) with:

```js
      option.addEventListener('click', () => {
        if (!enhancementState || !selectedBaseItem) {
          return;
        }

        if (scroll.behavior_type === 'chaos') {
          // Collapse any existing chaos panel first
          collapseChaosPanel();

          // Set this as the active chaos scroll
          activeChaosScroll = scroll;
          activeChaosOptionEl = option;

          // Initialize stepper values to 0 for all current stat keys
          const statKeys = getCurrentStatKeys();
          chaosStepperValues = new Map();
          statKeys.forEach((key) => {
            chaosStepperValues.set(key, 0);
          });

          // Render the chaos input panel
          renderChaosInputPanel(option);
          return;
        }

        // Non-chaos scroll: collapse chaos panel and apply normally
        collapseChaosPanel();

        const applied = applyScroll(enhancementState, scroll);
        if (!applied) {
          return;
        }

        hideScrollDetail();
        renderSlotRow();
        refreshEnhancedCard();
      });
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/enhancementPanel.mjs
git commit -m "feat: add chaos scroll click handling with expand/collapse logic

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Implement renderChaosInputPanel — stepper rows and 적용 button

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`

This task adds the core rendering function that creates stepper inputs and handles 적용.

- [ ] **Step 1: Add the renderChaosInputPanel function**

Insert after the `collapseChaosPanel` function:

```js
  const renderChaosInputPanel = (optionEl) => {
    if (!activeChaosScroll || !enhancementState) {
      return;
    }

    // Remove any existing panel
    const existingPanel = optionEl.querySelector('.chaos-input-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    const panel = document.createElement('div');
    panel.className = 'chaos-input-panel';

    const statKeys = getCurrentStatKeys();

    if (statKeys.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'chaos-empty-message';
      msg.textContent = '적용할 스탯이 없습니다';
      panel.append(msg);
      optionEl.append(panel);
      return;
    }

    // Create stepper rows
    statKeys.forEach((key) => {
      const currentValue = chaosStepperValues.get(key) ?? 0;

      const row = document.createElement('div');
      row.className = 'chaos-stat-row';

      const label = document.createElement('span');
      label.className = 'chaos-stat-label';
      label.textContent = statLabelByKey[key] ?? key;

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'chaos-stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        const cur = chaosStepperValues.get(key) ?? 0;
        if (cur > -5) {
          chaosStepperValues.set(key, cur - 1);
          updateChaosStepperDisplay(row, key);
        }
      });

      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'chaos-stepper-value';
      valueDisplay.dataset.chaosStatKey = key;
      updateChaosStepperDisplay(row, key); // set initial text via helper

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'chaos-stepper-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        const cur = chaosStepperValues.get(key) ?? 0;
        if (cur < 5) {
          chaosStepperValues.set(key, cur + 1);
          updateChaosStepperDisplay(row, key);
        }
      });

      row.append(label, minusBtn, valueDisplay, plusBtn);
      panel.append(row);
    });

    // 적용 button
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'chaos-apply-button';
    applyBtn.textContent = '적용';

    const remaining = computeRemainingSlots(enhancementState);
    if (remaining <= 0) {
      applyBtn.disabled = true;
    }

    applyBtn.addEventListener('click', () => {
      if (!enhancementState || !activeChaosScroll) {
        return;
      }

      // Build stats object from non-zero deltas
      const stats = {};
      for (const [key, value] of chaosStepperValues.entries()) {
        if (value !== 0 && Number.isFinite(value)) {
          stats[key] = value;
        }
      }

      // If all deltas are 0, do nothing
      if (Object.keys(stats).length === 0) {
        return;
      }

      // Create a scroll entry with user-provided stats
      const scrollEntry = {
        id: activeChaosScroll.id,
        nameKo: activeChaosScroll.nameKo,
        equipmentKind: activeChaosScroll.equipmentKind,
        behavior_type: 'chaos',
        stats,
      };

      const applied = applyScroll(enhancementState, scrollEntry);
      if (!applied) {
        return;
      }

      hideScrollDetail();
      renderSlotRow();
      refreshEnhancedCard();

      // Re-render the chaos panel to include any new stats
      renderChaosInputPanel(optionEl);

      // Disable 적용 button if no more slots
      const newRemaining = computeRemainingSlots(enhancementState);
      if (newRemaining <= 0) {
        const btn = optionEl.querySelector('.chaos-apply-button');
        if (btn) {
          btn.disabled = true;
        }
      }
    });

    panel.append(applyBtn);
    optionEl.append(panel);
  };

  const updateChaosStepperDisplay = (rowEl, key) => {
    const valueDisplay = rowEl.querySelector('.chaos-stepper-value');
    if (!valueDisplay) return;
    const value = chaosStepperValues.get(key) ?? 0;
    if (value > 0) {
      valueDisplay.textContent = `+${value}`;
    } else {
      valueDisplay.textContent = String(value);
    }
  };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/enhancementPanel.mjs
git commit -m "feat: add chaos input panel rendering with steppers and 적용 button

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Collapse chaos panel on reset and item change

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`

- [ ] **Step 1: Collapse chaos panel in reset handler**

In the `resetButton` click handler (line 248), add `collapseChaosPanel()` after `resetState(enhancementState)`:

The handler currently reads:
```js
  resetButton?.addEventListener('click', () => {
    if (!enhancementState || !selectedBaseItem) {
      return;
    }

    resetState(enhancementState);
    hideScrollDetail();
    renderSlotRow();
    makerPanel.resetMakerUI();
    refreshEnhancedCard();
  });
```

Change to:
```js
  resetButton?.addEventListener('click', () => {
    if (!enhancementState || !selectedBaseItem) {
      return;
    }

    resetState(enhancementState);
    collapseChaosPanel();
    hideScrollDetail();
    renderSlotRow();
    makerPanel.resetMakerUI();
    refreshEnhancedCard();
  });
```

- [ ] **Step 2: Collapse chaos panel on item change**

In `activatePanel2` (line 210), add `collapseChaosPanel()` after `enhancementState = createEnhancementState(...)`:

After the line:
```js
    enhancementState = createEnhancementState(upgradeSlots, item.requiredLevel ?? 0);
```

Add:
```js
    collapseChaosPanel();
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/enhancementPanel.mjs
git commit -m "fix: collapse chaos panel on reset and item change

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Add CSS for chaos panel components

**Files:**
- Modify: `src/pages/index.astro`

Add CSS rules after the existing `.enhancement-message[hidden]` block (after line 1741).

- [ ] **Step 1: Add chaos panel CSS**

Insert the following CSS block after line 1741 (after the closing `}` of `.enhancement-message[hidden]`):

```css
  /* Chaos scroll input panel */
  :global(.chaos-input-panel) {
    margin-top: 8px;
    padding: 10px 8px;
    border-top: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  :global(.chaos-empty-message) {
    color: var(--muted);
    font-size: 0.85rem;
    text-align: center;
    padding: 8px 0;
  }

  :global(.chaos-stat-row) {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  :global(.chaos-stat-label) {
    min-width: 80px;
    font-size: 0.88rem;
    font-weight: 650;
    color: var(--ink);
  }

  :global(.chaos-stepper-btn) {
    width: 28px;
    height: 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    font-size: 1rem;
    font-weight: 700;
    cursor: pointer;
    line-height: 1;
    padding: 0;
    transition: background 0.15s, border-color 0.15s;
  }

  :global(.chaos-stepper-btn:hover),
  :global(.chaos-stepper-btn:focus-visible) {
    border-color: var(--green);
    background: var(--surface-soft);
    outline: none;
  }

  :global(.chaos-stepper-value) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 36px;
    padding: 0 6px;
    height: 28px;
    border: 1px solid var(--line);
    border-radius: 6px;
    background: var(--surface);
    color: var(--ink);
    font-size: 0.9rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
  }

  :global(.chaos-apply-button) {
    align-self: flex-end;
    padding: 6px 20px;
    border: 1px solid var(--green);
    border-radius: 6px;
    background: var(--green);
    color: #fff;
    font-size: 0.9rem;
    font-weight: 700;
    cursor: pointer;
    transition: opacity 0.15s;
  }

  :global(.chaos-apply-button:hover),
  :global(.chaos-apply-button:focus-visible) {
    opacity: 0.85;
    outline: none;
  }

  :global(.chaos-apply-button:disabled) {
    opacity: 0.4;
    cursor: not-allowed;
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/index.astro
git commit -m "style: add CSS for chaos scroll input panel, steppers, and 적용 button

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: Collapse chaos panel when reverting to a slot

**Files:**
- Modify: `src/lib/enhancementPanel.mjs`

When the user clicks a filled slot to revert, the chaos panel should also collapse since the accumulated stats may change.

- [ ] **Step 1: Add collapseChaosPanel call in renderSlotRow's slot click handler**

In the `renderSlotRow` function, find the click handler that fires when a slot has a scroll (around line 98-105):

```js
      if (scroll || isCurrent) {
        box.addEventListener('click', () => {
          if (scroll) {
            revertToSlot(enhancementState, i);
            renderSlotRow();
            showScrollDetail(scroll);
            refreshEnhancedCard();
          }
        });
      }
```

Change to:
```js
      if (scroll || isCurrent) {
        box.addEventListener('click', () => {
          if (scroll) {
            collapseChaosPanel();
            revertToSlot(enhancementState, i);
            renderSlotRow();
            showScrollDetail(scroll);
            refreshEnhancedCard();
          }
        });
      }
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/enhancementPanel.mjs
git commit -m "fix: collapse chaos panel when reverting to a slot

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Build and verify the project compiles

**Files:**
- (none — verification only)

- [ ] **Step 1: Build the project**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Quick sanity check — start dev server**

Run: `npm run dev -- --host 0.0.0.0`
Expected: Dev server starts. Verify the page loads at `http://localhost:4321`.

- [ ] **Step 3: Stop dev server and commit (if build succeeded)**

```bash
# Stop dev server (Ctrl+C), then:
git add -A
git commit -m "chore: verify build succeeds with chaos scroll changes

Co-Authored-By: Claude <noreply@anthropic.com>"
```
