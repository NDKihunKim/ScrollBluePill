# Chaos Scroll ("혼돈의 주문서 60%") Design

**Date:** 2026-06-10
**Status:** Approved

## Overview

Add a new scroll type — "혼돈의 주문서 60%" (item ID 2049100) — with `behavior_type: "chaos"`. Unlike `fixed` and `random` scrolls whose stats are predetermined in the data, a chaos scroll lets the user specify stat delta values (-5 to +5) per stat that the item currently has at the moment of application.

## Motivation

Chaos scrolls in MapleStory randomly increase or decrease each stat on an item by 0-5. In this calculator, users simulate the outcome by manually entering the stat changes they got in-game. The tool records these values so users can plan their scrolling paths and see accumulated results.

## Design

### 1. Data Model

**New behavior type in `src/lib/models.ts`:**

```ts
behaviorType: 'fixed' | 'random' | 'chaos' | 'unknown';
```

**Scroll definition** — injected via new local override file `public/data/scroll-overrides.local.json` (fetched at runtime as `/data/scroll-overrides.local.json`):

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

- `equipmentKind: "*"` means the scroll appears for **all** equipment kinds. When merging, the loader clones the scroll into every equipment kind's list in `scrollsByEquipmentKind`.
- `stats: {}` is empty because stat values come from user input at application time.
- **Sorting:** Chaos scrolls are always sorted to the **end** of each equipment kind's scroll list (after all fixed/random scrolls). This keeps the expandable UI at the bottom where it won't push other scroll options around.

### 2. Runtime Data Injection

`enhancementPanel.mjs` fetches `scroll-overrides.local.json` after loading the main scroll index, then merges override scrolls into every equipment kind's list. This avoids modifying the Supabase generation pipeline and allows adding custom scrolls without DB access.

### 3. UI Flow

When a chaos scroll is clicked in the scroll list:

1. **Inline expansion:** A `.chaos-input-panel` opens below the scroll name/icon, pushing other scroll options down. Only one chaos panel is open at a time.

2. **Stat stepper rows:** One row per stat the item currently has (from `computeAccumulatedStats`, excluding internal keys `upgradeSlots` and `attackSpeed`). Each row:
   - Stat label (Korean, from `statLabelByKey`)
   - `[−]` button (decrement, min -5)
   - Current value display
   - `[+]` button (increment, max +5)

3. **"적용" button:** Constructs a scroll stats object from non-zero deltas, calls `applyScroll()`, then:
   - Slot row and item card refresh
   - Input values are **kept** for quick re-application
   - Button is disabled when `computeRemainingSlots() === 0`

4. **Auto-expand on stat change:** After 적용 adds a new stat (e.g., ATT), the panel re-renders to include the new stat as an input row.

5. **Collapse rules:**
   - Clicking a different scroll (chaos or fixed/random) collapses the panel
   - Fixed/random scrolls apply immediately on click as before
   - Reverting to a different slot, resetting, or changing items collapses the panel

### 4. State Management

- **Stepper values stored in JS state** (a `Map` keyed by stat key), not read from DOM
- Values persist across 적용 — user can click 적용 repeatedly for the same deltas
- State is cleared when the chaos panel collapses or a new chaos scroll is opened
- The panel re-renders its rows whenever accumulated stats change

### 5. Edge Cases

| Case | Behavior |
|------|----------|
| Item has only 1 stat (e.g., clean 노가다 목장갑: only 물리방어력) | Show 1 stepper row |
| All deltas are 0 | 적용 does nothing (no empty scroll applied); consider disabling 적용 button |
| No remaining slots | 적용 button disabled; panel stays open (user can see values) |
| Item has no stats at all | Show message "적용할 스탯이 없습니다" |
| Reset button clicked | Collapse chaos panel, clear stepper state |
| Item changed | Collapse chaos panel, clear stepper state |

### 6. CSS

New classes added to `index.astro`:
- `.chaos-input-panel` — the inline expansion container
- `.chaos-stat-row` — single stat stepper row
- `.chaos-stepper-btn` — `[−]` / `[+]` buttons
- `.chaos-stepper-value` — the displayed value
- `.chaos-apply-button` — the 적용 action button
- `.chaos-apply-button:disabled` — disabled state

### 7. Files Changed

| File | Change |
|------|--------|
| `src/lib/models.ts` | Add `"chaos"` to `behaviorType` union |
| `public/data/scroll-overrides.local.json` | **New** — chaos scroll definition (must be in `public/` to be fetchable at runtime via `/data/scroll-overrides.local.json`) |
| `src/lib/enhancementPanel.mjs` | Load overrides, inline expansion, stepper logic, 적용 handler with JS state |
| `src/pages/index.astro` | CSS for chaos panel components |

### 8. Non-Goals

- Random simulation — the user provides values; the tool does not generate random stat changes
- Supabase integration for chaos scrolls — local override file is sufficient; can migrate later
- Supporting chaos scrolls on other item IDs — the mechanism is extensible but only 2049100 is in scope

### 9. Testing Checklist

- [ ] 혼돈의 주문서 appears in scroll list for every equipment kind
- [ ] Clicking it expands inline with correct stat rows for the item's current state
- [ ] Steppers constrained to [-5, +5], buttons work correctly
- [ ] 적용 creates a scroll entry in the current slot
- [ ] Item card updates with new accumulated stats
- [ ] Values persist after 적용; clicking again applies same deltas to next slot
- [ ] 적용 button disables when no slots remain
- [ ] After first 적용 adds a new stat, the chaos panel re-renders to show the new stat
- [ ] Clicking a fixed scroll while chaos panel is open collapses it and applies fixed scroll
- [ ] Reset collapses chaos panel and clears state
