# 아이템 해체분석기 (Item Deconstruction Analyzer) & Site Restructure

**Date:** 2026-06-18
**Status:** design

## Summary

Add a new calculator tool called 아이템 해체분석기 that finds all possible enhancement strategies to create a target item with specific stats. Restructure the site to support multiple calculators from a shared homepage, with shared components for extensibility.

## Page structure

| URL | Content |
|-----|---------|
| `/` | Homepage — two cards linking to each calculator |
| `/expected-value` | 기대값 계산기 (moved from `/`) |
| `/deconstruction` | 아이템 해체분석기 (new) |

## Homepage (`/`)

Two large cards side by side in a responsive grid:

```
┌─────────────────────┐  ┌─────────────────────┐
│  기대값 계산기       │  │  아이템 해체분석기   │
│  주문서, 보석,       │  │  목표 아이템의      │
│  촉진제, 레벨업을    │  │  최종 스탯을        │
│  조합하여 목표       │  │  만들 수 있는       │
│  스탯 도달에 필요한  │  │  모든 방법을        │
│  평균 제작 횟수를    │  │  찾아냅니다         │
│  계산합니다          │  │                     │
│  [시작하기]          │  │  [시작하기]          │
└─────────────────────┘  └─────────────────────┘
```

Each card has a title, description, and a call-to-action link.

## 아이템 해체분석기 (`/deconstruction`)

### Layout

Same two-column format as the existing calculator: left stack for interaction panels, right sidebar for target item preview.

### Left stack panels

| Panel | Heading | Purpose |
|-------|---------|---------|
| 1 | 아이템 검색 | Search/select base item from database |
| 2 | 스탯 편집 | Edit stat deltas from base. Steppers for each existing stat, ability to add/remove stats. |
| 3 | 해체 결과 | Results grouped by approach, filterable by maker system. |

### Panel 1: 아이템 검색

Reuses the existing item search component — name search, manual filter accordion, suggestion list. On item select:
- Panel 2 activates with stat editors for all stats present on the base item
- Target item card in the right sidebar updates

### Panel 2: 스탯 편집

- Shows a stepper row for each stat on the base item
- Each row: stat label, −/MIN/+ steppers, current delta value (e.g., "+7")
- Deltas start at 0. User adjusts up/down: HP/MP in steps of 10 up to ±50, all other stats in steps of 1 up to ±5 (matching chaos scroll limits for non-HP/MP, stimulant limits for HP/MP)
- Ability to add stats not on the base item (dropdown of available stat keys). Added stats appear as new stepper rows. Removed via an × button on the row.
- The target item card in the right sidebar updates live as deltas change

### Panel 3: 해체 결과

- Triggered by 분석 시작 button in panel 2
- Results grouped by approach/maker system
- Each result shows: strategy details (scroll list, gem list, stimulant, level-up), success probability
- Filter chips to show/hide strategies by maker system used (e.g., "보석 있음", "촉진제 있음", "레벨업 있음", "주문서만")
- Sorted by probability (highest first within each group)

### Right sidebar

Target item preview — shows the final item with all edited stats applied (base + deltas). Same card format as existing calculator. Empty state shows "아이템을 선택해주세요" placeholder.

### How deconstruction works

1. User searches and selects a base item
2. Panel 2 activates — user edits stat deltas
3. Target card updates live as deltas change
4. User clicks 분석 시작
5. Engine enumerates all valid scroll/gem/stimulant/level-up combinations that produce exactly those stat deltas
6. Results appear in panel 3

### Deconstruction engine algorithm

The engine works backwards from target stat deltas:

1. Read target deltas from panel 2
2. Enumerate all scroll combinations that can produce the exact deltas (or contribute toward them):
   - Fixed scrolls: direct stat matches
   - Chaos scrolls: all stat delta permutations within chaos bounds (-5..+5 per stat)
3. Enumerate maker gem combinations that contribute remaining deltas (fixed gems: exact match; variable gems: within grade bounds)
4. Enumerate stimulant contributions (stepper range -5..+5 per stat, HP/MP -50..+50)
5. Enumerate item level-up contributions (within definition stat ranges)
6. Combine into full strategies — scroll set + optional maker + optional stimulant + optional level-up
7. For each strategy, compute success probability:
   - All 100% scrolls + manual makers → exact (p = 1.0)
   - Any non-100% scroll, chaos scroll, or probability-mode maker → multiply individual probabilities
8. Cap at 200 strategies. If more exist, show count truncated.

### Deconstruction engine rules

- Same set of scrolls regardless of order = one strategy (except chaos scrolls)
- Chaos scrolls generate separate strategies per distinct stat delta combination
- Each strategy includes success probability
- Strategy display omits probability when p = 1.0 (deterministic)

### Filtering

Filter chips in panel 3 toggle visibility:
- "전체" — all strategies
- "주문서만" — strategies using only scrolls (no maker/level-up)
- "보석 있음" — strategies using maker gems
- "촉진제 있음" — strategies using stimulant
- "레벨업 있음" — strategies using item level-up

## Shared component architecture

To support future calculators with minimal boilerplate, extract shared components:

### CalculatorLayout.astro

Two-column grid shell with named slots:
- `hero` — hero band with title/description
- `left` — left stack of interaction panels
- `sidebar` — right sidebar for item preview

Handles `<BaseLayout>` wrapping, page title, meta description.

### ItemSearchPanel.astro

Reusable item search panel:
- Name search input, suggestion list
- Manual filter accordion (jobs, equipment kind, level range)
- Emits selected item via callback prop
- Handles item index fetching, filtering, rendering

### ItemPreviewCard.astro

Reusable item card:
- Props: `item`, `accumulatedStats`, `remainingSlots`, `appliedCount`, `gradeColor`, `statBreakdown`
- Renders item name, icon, requirements, jobs, stats
- Empty state placeholder when no item provided

### Usage in calculator pages

```astro
<CalculatorLayout title="아이템 해체분석기" description="...">
  <slot name="left">
    <ItemSearchPanel onSelect={handleItemSelect} />
    <!-- calculator-specific panels -->
  </slot>
  <slot name="sidebar">
    <ItemPreviewCard item={targetItem} stats={previewStats} />
  </slot>
</CalculatorLayout>
```

**Adding a third calculator in the future:**
1. Create `src/pages/new-calc.astro`
2. Import Layout + components
3. Add card to homepage
4. Done

## Migration plan for existing calculator

1. Extract `CalculatorLayout.astro` from index.astro
2. Extract `ItemSearchPanel.astro` from index.astro
3. Extract `ItemPreviewCard.astro` from index.astro
4. Create `src/pages/expected-value.astro` using shared components
5. Create `src/pages/index.astro` as homepage
6. Verify the existing calculator works identically
7. Build deconstruction calculator on top of shared components

## Scope boundaries

**In scope:**
- Homepage with two calculator cards
- Shared component extraction (Layout, ItemSearch, ItemPreview)
- Existing calculator migration to `/expected-value`
- Deconstruction calculator page with panels 1-3
- Stat delta editing UI
- Deconstruction engine (strategy enumeration)
- Result display with grouping and filtering

**Out of scope (future):**
- Cost/rarity optimization of strategies
- Export/share results
- Probability simulation for complex strategies (initial version uses exact probability for deterministic, simple probability for non-deterministic)
- Saving/loading target items

## Edge cases

- **Item with no upgrade slots:** Panel 2 shows message "강화 불가능한 아이템입니다"
- **Target stats identical to base:** No deltas needed — trivial "no enhancements" strategy
- **Impossible target:** e.g., STR +100 on an item with 3 slots and no scroll can give that much. Show "달성 불가능한 목표입니다"
- **Too many results:** Cap at a reasonable limit (e.g., 200) with a message showing how many were truncated
- **Item change during editing:** Reset deltas, keep new base item
