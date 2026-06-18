# 아이템 해체분석기 & Site Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the site into a homepage with two calculators, extract shared components, and build the new 아이템 해체분석기 at `/deconstruction` that finds all enhancement strategies to produce a target item's stats.

**Architecture:** Extract three shared Astro components (CalculatorLayout, ItemSearchPanel, ItemPreviewCard) from the existing calculator. Migrate existing calculator to `/expected-value`. Build homepage at `/`. Build deconstruction calculator with stat delta editor and strategy enumeration engine. All calculators share the same item data, scroll data, and enhancement modules.

**Tech Stack:** Astro, vanilla JS (no framework), Node.js test runner, existing MapleStory data modules

---

## File Structure Map

```
src/
├── components/
│   ├── CalculatorLayout.astro    ← NEW: shared two-column shell
│   ├── ItemSearchPanel.astro     ← NEW: shared item search panel
│   └── ItemPreviewCard.astro     ← NEW: shared item preview card
├── layouts/
│   └── BaseLayout.astro          ← existing (unchanged)
├── pages/
│   ├── index.astro               ← REWRITE: homepage with two cards
│   ├── expected-value.astro      ← NEW: 기대값 계산기 (migrated from index.astro)
│   └── deconstruction.astro      ← NEW: 아이템 해체분석기
└── lib/
    ├── deconstruction/
    │   └── engine.mjs            ← NEW: strategy enumeration engine
    ├── expectedValue/            ← existing (unchanged)
    ├── enhancementState.mjs      ← existing (unchanged)
    ├── enhancementPanel.mjs      ← existing (unchanged)
    ├── makerPanel.mjs            ← existing (unchanged)
    ├── itemLevelUpPanel.mjs      ← existing (unchanged)
    ├── makerData.mjs             ← existing (unchanged)
    ├── scrollState.mjs           ← existing (unchanged)
    └── maplestoryIo.mjs          ← existing (unchanged)

tests/
├── deconstruction-engine.test.mjs  ← NEW: engine unit tests
└── (existing tests unchanged)
```

---

## Phase 1: Shared Component Extraction

### Task 1: Create CalculatorLayout.astro

**Files:**
- Create: `src/components/CalculatorLayout.astro`

**Purpose:** Shared two-column layout shell wrapping BaseLayout. Provides named slots for hero, left, and sidebar content.

- [ ] **Step 1: Write the component**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';

export interface Props {
  title: string;
  description: string;
  eyebrow?: string;
}

const { title, description, eyebrow } = Astro.props;
---

<BaseLayout title={title} description={description}>
  {
    eyebrow ? (
      <section class="band">
        <div class="container">
          <p class="eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
        </div>
      </section>
    ) : (
      <section class="band">
        <div class="container">
          <h1>{title}</h1>
        </div>
      </section>
    )
  }

  <section class="band">
    <div class="container grid two">
      <div class="left-stack">
        <slot name="left" />
      </div>
      <aside class="panel" aria-label="아이템 미리보기">
        <slot name="sidebar" />
      </aside>
    </div>
  </section>
</BaseLayout>

<style>
  .left-stack {
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-width: 0;
  }

  aside.panel {
    position: sticky;
    top: 1rem;
    align-self: start;
  }

  .panel > h2 {
    margin-bottom: 10px;
    color: var(--ink);
    font-size: clamp(1.05rem, 1.5vw, 1.35rem);
    font-weight: 800;
    line-height: 1.2;
  }

  @media (max-width: 760px) {
    aside.panel {
      max-width: 315px;
      justify-self: center;
      width: 100%;
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/CalculatorLayout.astro
git commit -m "feat: add shared CalculatorLayout component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Create ItemPreviewCard.astro

**Files:**
- Create: `src/components/ItemPreviewCard.astro`

**Purpose:** Shared item preview card component. Renders the selected item card with stats, requirements, and jobs. Handles empty state with placeholder.

- [ ] **Step 1: Write the component**

```astro
---
export interface Props {
  item?: {
    id: number;
    nameKo: string;
    equipmentKind: string;
    requiredLevel: number;
    requiredJobs?: string[];
    requirements?: Record<string, number>;
    stats?: Record<string, number>;
    typeInfo?: { subCategory?: string };
  } | null;
  accumulatedStats?: Record<string, number> | null;
  remainingSlots?: number;
  appliedCount?: number;
  gradeColor?: string;
  statBreakdown?: Record<string, any>;
  itemLevelUpMeta?: { itemLevel: number; itemExp: number } | null;
  placeholder?: string;
}

const {
  item,
  accumulatedStats,
  remainingSlots,
  appliedCount,
  gradeColor,
  statBreakdown,
  itemLevelUpMeta,
  placeholder = '아이템을 선택해주세요',
} = Astro.props;
---

{
  !item ? (
    <p class="enhancement-placeholder">{placeholder}</p>
  ) : (
    <div class="selected-item-card">
      <h3 data-selected-item-name style={gradeColor ? `color: ${gradeColor}` : ''}>
        {item.nameKo}{appliedCount && appliedCount > 0 ? ` (+${appliedCount})` : ''}
      </h3>
      <div class="selected-item-top">
        <div class="selected-item-icon-frame">
          <img data-selected-item-icon alt="" loading="lazy" />
        </div>
        <div class="selected-item-requirements" data-selected-item-requirements>
        </div>
      </div>
      <div class="selected-item-jobs" data-selected-item-jobs></div>
      <div class="selected-item-divider"></div>
      <div class="selected-item-stats" data-selected-item-stats></div>
    </div>
  )
}

<style>
  .enhancement-placeholder {
    color: var(--muted);
    font-size: 0.92rem;
    text-align: center;
    padding: 24px 0;
  }

  .selected-item-card {
    display: grid;
    gap: 7px;
    margin-bottom: 12px;
    padding: 14px;
    border: 2px solid #f4f1ff;
    border-radius: 8px;
    background: #4d4c78;
    color: white;
    box-shadow: inset 0 0 0 1px rgb(255 255 255 / 10%);
  }

  :root[data-theme='dark'] .selected-item-card {
    border-color: #2f6073;
  }

  .selected-item-card[hidden] {
    display: none;
  }

  .selected-item-card h3 {
    margin: 0;
    color: white;
    font-size: 1.1rem;
    line-height: 1.15;
    text-align: center;
  }

  .selected-item-top {
    display: grid;
    grid-template-columns: 96px minmax(0, 1fr);
    gap: 12px;
    align-items: start;
  }

  .selected-item-icon-frame {
    display: grid;
    width: 96px;
    height: 96px;
    place-items: center;
    background: #c8c8d2;
  }

  .selected-item-icon-frame img {
    width: 72px;
    height: 72px;
    object-fit: contain;
    image-rendering: pixelated;
  }

  .selected-item-requirements,
  .selected-item-stats {
    display: grid;
    gap: 2px;
    font-size: 0.875rem;
    line-height: 1.25;
  }

  .selected-item-requirements {
    gap: 0;
  }

  .selected-item-stats {
    gap: 2px;
    justify-items: center;
    font-size: 0.94rem;
  }

  .selected-item-divider {
    height: 3px;
    background: white;
  }

  .selected-item-jobs {
    padding: 1px 0;
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ItemPreviewCard.astro
git commit -m "feat: add shared ItemPreviewCard component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Create ItemSearchPanel.astro

**Files:**
- Create: `src/components/ItemSearchPanel.astro`

**Purpose:** Shared item search panel with name search, manual filter accordion, and suggestion list. This is the panel 1 for both calculators. The component exposes a `data-item-search-panel` wrapper and renders the search form HTML. The JavaScript for search logic will be inlined in the component's `<script>` block, extracted from the current `index.astro`.

- [ ] **Step 1: Write the component**

This task extracts the entire `<form class="panel" data-calculator-input>` block from `index.astro` into `ItemSearchPanel.astro`. The form HTML structure is copied, and the `<script>` block imports the search logic. The component accepts no props — it communicates via a window-level callback when an item is selected.

Due to the size of this extraction, the exact content is the current panel 1 HTML and JS from `index.astro:24-258` (the form) and `index.astro:337-1160` (the item search JS), adapted to use the component's own scope.

- [ ] **Step 2: Commit**

```bash
git add src/components/ItemSearchPanel.astro
git commit -m "feat: add shared ItemSearchPanel component

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 2: Homepage + Calculator Migration

### Task 4: Create homepage at `/`

**Files:**
- Create: `src/pages/index.astro` (rewrite)

**Purpose:** Simple homepage with two cards linking to the two calculators. Uses BaseLayout directly.

- [ ] **Step 1: Write the homepage**

```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---

<BaseLayout
  title="아이템 제작 횟수 기대값 계산기"
  description="MapleWorlds 옛날 메이플 아이템 제작 분석 도구입니다."
>
  <section class="band">
    <div class="container">
      <h1>아이템 제작 분석 도구</h1>
      <p class="lede">
        메이플스토리 월드 옛날 서버의 아이템 강화를 분석하는 두 가지 도구입니다.
      </p>
    </div>
  </section>

  <section class="band">
    <div class="container">
      <div class="home-cards">
        <a class="home-card" href="/expected-value">
          <h2>기대값 계산기</h2>
          <p>
            주문서, 보석, 촉진제, 아이템 레벨업을 조합하여 목표 스탯에 도달하기까지
            필요한 평균 제작 횟수를 계산합니다.
          </p>
          <span class="home-card-cta">시작하기 →</span>
        </a>
        <a class="home-card" href="/deconstruction">
          <h2>아이템 해체분석기</h2>
          <p>
            목표 아이템의 최종 스탯을 만들 수 있는 모든 강화 방법과
            주문서 조합을 찾아냅니다.
          </p>
          <span class="home-card-cta">시작하기 →</span>
        </a>
      </div>
    </div>
  </section>
</BaseLayout>

<style>
  .lede {
    color: var(--muted);
    font-size: 1.05rem;
    line-height: 1.5;
    max-width: 42rem;
  }

  .home-cards {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 20px;
    margin-top: 8px;
  }

  .home-card {
    display: flex;
    flex-direction: column;
    padding: 28px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: var(--surface);
    text-decoration: none;
    color: var(--ink);
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }

  .home-card:hover {
    border-color: var(--green);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
    transform: translateY(-2px);
  }

  .home-card h2 {
    margin: 0 0 10px;
    font-size: 1.3rem;
    font-weight: 800;
  }

  .home-card p {
    color: var(--muted);
    font-size: 0.92rem;
    line-height: 1.5;
    margin: 0 0 16px;
    flex: 1;
  }

  .home-card-cta {
    display: inline-block;
    padding: 8px 18px;
    border: 1px solid var(--green);
    border-radius: 6px;
    background: var(--green);
    color: white;
    font-weight: 700;
    font-size: 0.9rem;
    align-self: flex-start;
    transition: opacity 0.15s;
  }

  .home-card:hover .home-card-cta {
    opacity: 0.85;
  }

  @media (max-width: 600px) {
    .home-cards {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: add homepage with calculator cards

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Migrate existing calculator to `/expected-value`

**Files:**
- Create: `src/pages/expected-value.astro` (copy of current `index.astro`, adapted for CalculatorLayout)
- Test: `tests/calculator-input-contract.test.mjs` (update source references)

**Purpose:** Move the existing 기대값 계산기 from `/` to `/expected-value`. The page uses `CalculatorLayout` with the existing enhancement form, calc panel, and result panel slotted into `left`. Item preview card in the sidebar.

- [ ] **Step 1: Create expected-value.astro**

This is a copy of the current `index.astro`, adapted to wrap with `CalculatorLayout` instead of `BaseLayout`. The item card HTML in the sidebar is replaced with an `<ItemPreviewCard>` reference that gets populated by the existing JS. The hero section content is passed as props to CalculatorLayout.

Key changes from current index.astro:
- Replace `<BaseLayout title="..." description="...">` with `<CalculatorLayout title="아이템 제작 횟수 기대값 계산기" description="...">`
- Replace the hero `<section class="band">` with slotless props (CalculatorLayout renders the hero)
- Keep all existing panel HTML (1. 아이템 검색, 2. 아이템 강화, 3. 계산, 4. 결과) in `<slot name="left">`
- Replace the sidebar HTML with `<slot name="sidebar">` + `<ItemPreviewCard>` that gets rendered by the existing JS
- Keep all existing `<script>` logic (enhancementPanel, expectedValue wiring)
- Remove CSS that's now in shared components

Given the size of this migration (~80KB file), the exact content is the current `index.astro` adapted as described above.

- [ ] **Step 2: Update test source references**

Tests in `tests/calculator-input-contract.test.mjs` and `tests/expected-value-ui-contract.test.mjs` reference `../src/pages/index.astro`. Update them to reference `../src/pages/expected-value.astro`.

```bash
# Update test references
sed -i '' 's|../src/pages/index.astro|../src/pages/expected-value.astro|g' tests/calculator-input-contract.test.mjs
sed -i '' 's|../src/pages/index.astro|../src/pages/expected-value.astro|g' tests/expected-value-ui-contract.test.mjs
sed -i '' 's|../src/pages/index.astro|../src/pages/expected-value.astro|g' tests/expected-value-chart-renderer.test.mjs
```

- [ ] **Step 3: Run tests to verify migration**

```bash
node --test tests/calculator-input-contract.test.mjs tests/expected-value-ui-contract.test.mjs tests/expected-value-chart-renderer.test.mjs
```

Expected: All tests pass with updated source references.

- [ ] **Step 4: Verify build**

```bash
npm run build
```

Expected: Build succeeds. `dist/expected-value/index.html` exists.

- [ ] **Step 5: Commit**

```bash
git add src/pages/expected-value.astro tests/
git commit -m "feat: migrate existing calculator to /expected-value

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: Deconstruction Calculator

### Task 6: Create deconstruction engine

**Files:**
- Create: `src/lib/deconstruction/engine.mjs`
- Test: `tests/deconstruction-engine.test.mjs`

**Purpose:** Core algorithm that enumerates all enhancement strategies to achieve given target stat deltas.

- [ ] **Step 1: Write the failing test**

```javascript
// tests/deconstruction-engine.test.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { enumerateStrategies } from '../src/lib/deconstruction/engine.mjs';

test('enumerateStrategies returns empty array for zero deltas', () => {
  const strategies = enumerateStrategies({
    targetDeltas: {},
    upgradeSlots: 7,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    itemLevelUpDefinition: null,
  });
  assert.deepEqual(strategies, []);
});

test('enumerateStrategies finds fixed scroll matches for single stat delta', () => {
  const strategies = enumerateStrategies({
    targetDeltas: { weaponAttack: 2 },
    upgradeSlots: 7,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    itemLevelUpDefinition: null,
  });

  // Should find strategies using 공격력 주문서 100% (+2 attack) or similar
  assert.ok(strategies.length > 0);
  const matching = strategies.filter(s => s.scrolls.length === 1);
  assert.ok(matching.length > 0);
});

test('enumerateStrategies caps at 200 strategies', () => {
  // With 7 slots and all stat types, combination count can explode
  // Engine should cap and report truncation
  const strategies = enumerateStrategies({
    targetDeltas: { str: 3, dex: 2, int: 1, luk: 1 },
    upgradeSlots: 7,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    itemLevelUpDefinition: null,
  });
  assert.ok(strategies.length <= 200);
});

test('each strategy has required shape', () => {
  const strategies = enumerateStrategies({
    targetDeltas: { weaponAttack: 2 },
    upgradeSlots: 7,
    equipmentKind: 'Glove',
    requiredLevel: 0,
    itemLevelUpDefinition: null,
  });
  for (const s of strategies) {
    assert.ok(Array.isArray(s.scrolls));
    assert.ok(Array.isArray(s.gems));
    assert.equal(typeof s.hasStimulant, 'boolean');
    assert.equal(typeof s.hasItemLevelUp, 'boolean');
    assert.equal(typeof s.probability, 'number');
    assert.ok(s.probability > 0 && s.probability <= 1);
    assert.ok(Array.isArray(s.approach));
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test tests/deconstruction-engine.test.mjs
```

Expected: FAIL — module not found or function not exported.

- [ ] **Step 3: Write the engine implementation**

```javascript
// src/lib/deconstruction/engine.mjs
import { computeGemSlotCount, getVisibleGemTypes } from '../makerData.mjs';
import { HP_MP_KEYS } from '../enhancementState.mjs';

const MAX_STRATEGIES = 200;
const CHAOS_LIMIT = 5;
const CHAOS_HPMP_LIMIT = 50;

/**
 * Enumerates all enhancement strategies that produce the exact target
 * stat deltas. Returns strategies sorted by probability descending,
 * capped at MAX_STRATEGIES.
 *
 * @param {{
 *   targetDeltas: Record<string, number>,
 *   upgradeSlots: number,
 *   equipmentKind: string,
 *   requiredLevel: number,
 *   itemLevelUpDefinition: object|null,
 *   scrollsByEquipmentKind?: Map<string, Array>,
 * }} params
 * @returns {{ strategies: Array, truncated: boolean, total: number }}
 */
export function enumerateStrategies({
  targetDeltas,
  upgradeSlots,
  equipmentKind,
  requiredLevel,
  itemLevelUpDefinition,
  scrollsByEquipmentKind,
}) {
  const activeKeys = Object.keys(targetDeltas).filter(
    k => targetDeltas[k] !== 0 && Number.isFinite(targetDeltas[k])
  );
  if (activeKeys.length === 0) return { strategies: [], truncated: false, total: 0 };

  const scrolls = scrollsByEquipmentKind?.get(equipmentKind) ?? [];
  const fixedScrolls = scrolls.filter(s => s.behavior_type !== 'chaos');
  const chaosScrolls = scrolls.filter(s => s.behavior_type === 'chaos');

  const strategies = [];
  const seen = new Set();

  // Phase 1: Scroll-only (fixed scrolls)
  _enumerateScrollCombinations({
    targetDeltas, upgradeSlots, fixedScrolls,
    strategies, seen, approach: ['주문서'],
  });

  // Phase 2: Scrolls + chaos (one chaos max per strategy)
  for (const chaos of chaosScrolls) {
    for (const chaosDeltas of _enumerateChaosDeltas(targetDeltas, activeKeys)) {
      const remaining = {};
      for (const k of activeKeys) {
        remaining[k] = targetDeltas[k] - (chaosDeltas[k] ?? 0);
      }
      _enumerateScrollCombinations({
        targetDeltas: remaining, upgradeSlots: upgradeSlots - 1,
        fixedScrolls, strategies, seen, approach: ['주문서', '카오스'],
      });
    }
  }

  // Phase 3-5: With maker systems (gems, stimulant, level-up)
  // Omitted for brevity — same pattern: subtract gem/stimulant/level-up
  // contributions from target, enumerate scrolls for remainder.

  const sorted = strategies
    .sort((a, b) => b.probability - a.probability)
    .slice(0, MAX_STRATEGIES);

  return {
    strategies: sorted,
    truncated: strategies.length > MAX_STRATEGIES,
    total: strategies.length,
  };
}

function _enumerateScrollCombinations({
  targetDeltas, upgradeSlots, fixedScrolls,
  strategies, seen, approach,
}) {
  // Reject if any remaining delta would require more slots than available
  // or has a sign that can't be produced by available scrolls.
  // Enumerate all valid N-scroll combinations (N <= upgradeSlots)
  // that exactly sum to targetDeltas.
  // Dedupe via `seen` set (sorted scroll IDs string key).
}

function _enumerateChaosDeltas(targetDeltas, activeKeys) {
  // For a chaos scroll, each active stat can vary independently
  // within [-5, 5] (or [-50, 50] for HP/MP).
  // Return generator of possible delta maps that don't overshoot the target.
}

function _computeProbability(scrolls, gems, stimulantMode, levelUpMode) {
  let p = 1.0;
  for (const s of scrolls) {
    const pctMatch = s.nameKo?.match(/(\d+)%/);
    p *= pctMatch ? parseInt(pctMatch[1], 10) / 100 : 1.0;
  }
  // Multiply gem, stimulant, level-up probabilities
  return p;
}
```

- [ ] **Step 4: Run basic tests**

```bash
node --test tests/deconstruction-engine.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/deconstruction/engine.mjs tests/deconstruction-engine.test.mjs
git commit -m "feat: add deconstruction engine skeleton with tests

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: Implement deconstruction engine core algorithm

**Files:**
- Modify: `src/lib/deconstruction/engine.mjs`
- Modify: `tests/deconstruction-engine.test.mjs`

**Purpose:** Implement the full strategy enumeration algorithm.

- [ ] **Step 1: Implement scroll combination enumeration**

Extend the engine to load scroll data, find scrolls matching the equipment kind, and enumerate combinations that sum to target deltas within the slot count. Handle chaos scrolls separately.

- [ ] **Step 2: Implement multi-system combinations**

Extend to include maker gems, stimulant, and item level-up contributions. Each strategy's probability is the product of individual component probabilities.

- [ ] **Step 3: Implement cap and sorting**

Cap at 200 strategies. Sort by probability descending.

- [ ] **Step 4: Run full engine tests**

```bash
node --test tests/deconstruction-engine.test.mjs
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/deconstruction/engine.mjs tests/deconstruction-engine.test.mjs
git commit -m "feat: implement deconstruction engine full algorithm

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: Create deconstruction calculator page

**Files:**
- Create: `src/pages/deconstruction.astro`

**Purpose:** The 아이템 해체분석기 page with three panels and the deconstruction engine wired in.

- [ ] **Step 1: Write the page structure**

```astro
---
import CalculatorLayout from '../components/CalculatorLayout.astro';
---

<CalculatorLayout
  title="아이템 해체분석기"
  description="MapleWorlds 옛날 메이플 아이템 해체분석을 위한 도구입니다."
>
  <slot name="left">
    <!-- Panel 1: 아이템 검색 — reuses ItemSearchPanel logic -->
    <form class="panel" aria-label="아이템 검색" data-decon-search>
      <h2>1. 아이템 검색</h2>
      <!-- item search fields (same as existing) -->
    </form>

    <!-- Panel 2: 스탯 편집 -->
    <section class="calculator-panel calc-panel" data-decon-edit-panel>
      <h2>2. 스탯 편집</h2>
      <p class="enhancement-placeholder" data-decon-edit-placeholder>
        먼저 위에서 아이템을 선택해주세요
      </p>
      <div data-decon-edit-content hidden>
        <div class="decon-stat-editor" data-decon-stat-editor></div>
        <div class="decon-add-stat-row">
          <select data-decon-add-stat-select>
            <option value="">스탯 추가...</option>
          </select>
          <button type="button" class="small-button" data-decon-add-stat-btn>추가</button>
        </div>
        <button type="button" class="ev-start-btn" data-decon-analyze-btn disabled>
          분석 시작
        </button>
      </div>
    </section>

    <!-- Panel 3: 해체 결과 -->
    <section class="calculator-panel result-panel" data-decon-result-panel>
      <h2>3. 해체 결과</h2>
      <p class="enhancement-placeholder" data-decon-result-placeholder>
        스탯 편집 후 분석 시작을 눌러주세요
      </p>
      <div data-decon-result-content hidden>
        <div class="decon-filter-chips" data-decon-filter-chips></div>
        <div class="decon-strategy-list" data-decon-strategy-list></div>
      </div>
    </section>
  </slot>

  <slot name="sidebar">
    <h2>아이템 미리보기</h2>
    <!-- Target item preview card rendered by JS -->
  </slot>
</CalculatorLayout>

<script>
  // Deconstruction calculator wiring
  // - Item search (shared logic)
  // - Stat delta editor
  // - Target card rendering
  // - 분석 시작 → enumerateStrategies
  // - Result display with filtering
</script>

<style>
  .decon-stat-editor {
    display: flex;
    flex-direction: column;
    gap: 6px;
    margin-bottom: 10px;
  }

  .decon-stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .decon-add-stat-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 14px;
  }

  .decon-filter-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 12px;
  }

  .decon-filter-chip {
    padding: 4px 12px;
    border: 1px solid var(--line);
    border-radius: 16px;
    background: var(--surface-soft);
    color: var(--ink);
    font-size: 0.82rem;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s;
  }

  .decon-filter-chip.active {
    border-color: var(--green);
    background: var(--green);
    color: white;
  }

  .decon-strategy-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    max-height: 480px;
    overflow-y: auto;
  }

  .decon-strategy-card {
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface-soft);
  }

  .decon-strategy-card h4 {
    margin: 0 0 6px;
    font-size: 0.95rem;
  }

  .decon-strategy-probability {
    font-size: 0.85rem;
    color: var(--green);
    font-weight: 700;
  }

  .decon-strategy-scrolls,
  .decon-strategy-gems {
    font-size: 0.82rem;
    color: var(--muted);
    margin-top: 4px;
  }

  .calculator-panel.calc-panel {
    padding: 14px;
    border: 1px solid var(--line);
    border-radius: 8px;
    background: var(--surface);
    box-shadow: var(--shadow);
  }

  .calculator-panel.calc-panel h2 {
    margin: 0 0 8px;
    color: var(--ink);
    font-size: clamp(1.05rem, 1.5vw, 1.35rem);
    font-weight: 800;
    line-height: 1.2;
  }
</style>
```

- [ ] **Step 2: Wire item search JS**

Import item search logic in the `<script>` block. On item select: activate panel 2 with stat editors, render target card in sidebar with base stats.

- [ ] **Step 3: Wire stat editor JS**

For each stat on the base item, create a stepper row. The delta value is tracked in a Map. Adding/removing stats modifies the editor. Target card updates live on each delta change.

- [ ] **Step 4: Wire 분석 시작 and result display**

On click: call `enumerateStrategies()` with current deltas. Display results grouped by approach, with filter chips functional. Clicking a filter chip toggles visibility of matching strategies.

- [ ] **Step 5: Verify page loads**

```bash
npm run dev
# Visit http://localhost:4321/deconstruction
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/deconstruction.astro
git commit -m "feat: add deconstruction calculator page

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: Integration & Polish

### Task 9: Full integration test

**Files:**
- Modify: `tests/` (any tests that reference old paths)

**Purpose:** Verify the full site works end-to-end after restructuring.

- [ ] **Step 1: Run all existing tests**

```bash
node --test tests/*.test.mjs
```

Expected: All tests pass with migrated source references.

- [ ] **Step 2: Verify build produces all pages**

```bash
npm run build
ls dist/
```

Expected: `dist/index.html`, `dist/expected-value/index.html`, `dist/deconstruction/index.html` all exist.

- [ ] **Step 3: Commit any test fixes**

```bash
git add -A
git commit -m "test: update test references for site restructure

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Update header navigation

**Files:**
- Modify: `src/layouts/BaseLayout.astro` (if it has nav links)

**Purpose:** Add links to both calculators in the site header/navigation so users can switch between tools.

- [ ] **Step 1: Check current header structure**

Read `src/layouts/BaseLayout.astro` to find the navigation section.

- [ ] **Step 2: Add calculator links**

Add "기대값 계산기" and "아이템 해체분석기" links to the navigation.

- [ ] **Step 3: Commit**

```bash
git add src/layouts/BaseLayout.astro
git commit -m "feat: add calculator nav links to header

Co-Authored-By: Claude <noreply@anthropic.com>"
```
