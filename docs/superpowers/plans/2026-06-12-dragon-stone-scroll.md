# Dragon Stone Scroll Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the Dragon Stone scroll (item 2041200) to the website — only applicable to Horntail Necklace (1122000), applied once per item.

**Architecture:** Extend the scroll_definitions table with two nullable columns (`target_item_id`, `max_applications`), pipe them through the generation script to the frontend JSON, enforce constraints in `scrollState.mjs` (apply rejection) and `enhancementPanel.mjs` (filtering + re-render on state change).

**Tech Stack:** Supabase REST API, Node.js (ESM), vanilla JS DOM manipulation

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `supabase/schema.sql` | Modify | Add `maplestory_io_item_id`, `target_item_id`, `max_applications` columns |
| `scripts/generate-scroll-index.mjs` | Modify | Bypass percent filter for item-specific scrolls; pass through new fields |
| `src/lib/scrollState.mjs` | Modify | Reject `applyScroll` when `maxApplications` reached |
| `src/lib/enhancementPanel.mjs` | Modify | Filter scroll list by `targetItemId` + `maxApplications`; re-render on apply/clear/reset |

---

### Task 1: Add database columns and Dragon Stone row

**Files:**
- Modify: `supabase/schema.sql:12-24`

- [ ] **Step 1: Add the three ALTER TABLE statements to schema.sql**

Add these lines after the existing `scroll_definitions` CREATE TABLE block (after line 24):

```sql
-- Backfill: column already exists in live DB but was missing from schema.sql
alter table public.scroll_definitions
    add column if not exists maplestory_io_item_id integer;

-- Item-specific scroll targeting (NULL = works on all items of the category)
alter table public.scroll_definitions
    add column if not exists target_item_id integer;

-- Maximum times this scroll can be applied to a single item (NULL = unlimited)
alter table public.scroll_definitions
    add column if not exists max_applications integer;
```

- [ ] **Step 2: Run the ALTER TABLE statements against Supabase**

Connect to Supabase SQL editor (or use the REST API) and run these three statements against the live database. Running them against the live DB ensures the columns exist before the INSERT.

Verify the columns exist:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'scroll_definitions'
  AND column_name IN ('maplestory_io_item_id', 'target_item_id', 'max_applications');
```

- [ ] **Step 3: Run the service_role GRANT so these columns are accessible via the API**

The existing service_role grant at line 77 grants UPDATE on specific columns (`published_status, name_ko, affected_stats, behavior_type`). The new columns won't be included. Update the grant statement (or run a new one) to include the new columns:

```sql
-- Extend service_role UPDATE grant to new columns
grant update (published_status, name_ko, affected_stats, behavior_type, maplestory_io_item_id, target_item_id, max_applications) on public.scroll_definitions to service_role;
```

- [ ] **Step 4: Update schema.sql with the updated GRANT**

In `supabase/schema.sql`, update line 77:
```sql
grant update (published_status, name_ko, affected_stats, behavior_type, maplestory_io_item_id, target_item_id, max_applications) on public.scroll_definitions to service_role;
```

- [ ] **Step 5: Insert the Dragon Stone row into Supabase**

Run this INSERT via Supabase SQL editor (or REST API with service_role key):

```sql
INSERT INTO public.scroll_definitions
  (version_tag_id, name_ko, category, behavior_type, published_status,
   affected_stats, stat_effect_frame,
   maplestory_io_item_id, target_item_id, max_applications, source_note)
VALUES
  ((SELECT id FROM version_tags WHERE is_active = true LIMIT 1),
   '드래곤의 돌', '펜던트', 'fixed', 'published',
   ARRAY['weaponDefense','magicDefense','avoidability','str','dex','int','luk'],
   '{"weaponDefense":140,"magicDefense":140,"avoidability":15,"str":15,"dex":15,"int":15,"luk":15}',
   2041200, 1122000, 1,
   'Dragon Stone — Horntail Necklace only, once per item');
```

- [ ] **Step 6: Verify the INSERT**

```sql
SELECT id, name_ko, category, maplestory_io_item_id, target_item_id, max_applications
FROM scroll_definitions
WHERE maplestory_io_item_id = 2041200;
```

Expected: one row with `target_item_id = 1122000`, `max_applications = 1`.

- [ ] **Step 7: Commit schema changes**

```bash
git add supabase/schema.sql
git commit -m "feat: add scroll_definitions columns for item-specific targeting and max applications

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Pipeline — bypass percent filter, pass through new fields

**Files:**
- Modify: `scripts/generate-scroll-index.mjs:37-56`

- [ ] **Step 1: Update `filterDesiredPercentScrolls` to bypass for item-specific scrolls**

Replace the existing function at lines 37-46:

```javascript
function filterDesiredPercentScrolls(scrolls) {
    return scrolls.filter((scroll) => {
        // Item-specific scrolls always pass — they are explicitly curated
        if (scroll.target_item_id != null) {
            return true;
        }
        const match = scroll.name_ko?.match(PERCENT_PATTERN);
        if (!match) {
            return false;
        }
        const percent = Number(match[1]);
        return DESIRED_PERCENTS.has(percent);
    });
}
```

- [ ] **Step 2: Update `transformToFrontendSchema` to pass through new fields**

Replace the existing function at lines 49-57:

```javascript
function transformToFrontendSchema(row) {
    return {
        id: row.maplestory_io_item_id,
        nameKo: row.name_ko,
        equipmentKind: row.category,
        behavior_type: row.behavior_type,
        stats: row.stat_effect_frame ?? {},
        targetItemId: row.target_item_id ?? null,
        maxApplications: row.max_applications ?? null,
    };
}
```

- [ ] **Step 3: Run the generation script**

```bash
node scripts/generate-scroll-index.mjs
```

Expected output: should show the Dragon Stone in the count (e.g., "Generated ... with N scrolls"), and `펜던트` should now appear in the category breakdown.

- [ ] **Step 4: Verify the Dragon Stone appears in the output JSON**

```bash
grep -A 8 "2041200" public/data/scrolls-gms83-ko.json
```

Expected: a JSON entry with `"id": 2041200`, `"equipmentKind": "펜던트"`, `"targetItemId": 1122000`, `"maxApplications": 1`, and the correct stats.

- [ ] **Step 5: Commit**

```bash
git add scripts/generate-scroll-index.mjs public/data/scrolls-gms83-ko.json
git commit -m "feat: bypass percent filter for item-specific scrolls, pass targetItemId/maxApplications to frontend

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Scroll state — reject applyScroll when max reached

**Files:**
- Modify: `src/lib/scrollState.mjs:26-45`

- [ ] **Step 1: Add maxApplications check to applyScroll**

In `applyScroll`, add the count check before the slot-bounds check. Insert after line 27 (`if (state.currentSlot >= state.slotCount) { return false; }`):

```javascript
export function applyScroll(state, scroll) {
  if (state.currentSlot >= state.slotCount) {
    return false;
  }

  // Reject if this scroll has a max-application limit and it's been reached
  if (scroll.maxApplications != null) {
    const alreadyApplied = state.slots.filter(s => s?.id === scroll.id).length;
    if (alreadyApplied >= scroll.maxApplications) {
      return false;
    }
  }

  const wasFilled = state.slots[state.currentSlot] !== null;
  state.slots[state.currentSlot] = scroll;

  if (wasFilled) {
    // Replacement: advance to the next empty slot
    let next = state.currentSlot + 1;
    while (next < state.slotCount && state.slots[next] !== null) {
      next++;
    }
    state.currentSlot = next;
  } else {
    state.currentSlot += 1;
  }
  return true;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/scrollState.mjs
git commit -m "feat: reject applyScroll when maxApplications limit reached

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Enhancement panel — filter scrolls by item and max, re-render on state change

**Files:**
- Modify: `src/lib/enhancementPanel.mjs:385-399` (renderScrollList)
- Modify: `src/lib/enhancementPanel.mjs:120-130` (clearSlot handler)
- Modify: `src/lib/enhancementPanel.mjs:354-366` (chaos apply handler)
- Modify: `src/lib/enhancementPanel.mjs:470-483` (fixed/random apply handler)
- Modify: `src/lib/enhancementPanel.mjs:549` (activatePanel2 call site)
- Modify: `src/lib/enhancementPanel.mjs:554-565` (reset handler)

- [ ] **Step 1: Change `renderScrollList` signature and add two-phase filtering**

Replace lines 385-399. Old:

```javascript
  const renderScrollList = (equipmentKind) => {
    if (!(scrollList instanceof HTMLElement) || !(enhancementMessage instanceof HTMLElement)) {
      return;
    }

    scrollList.replaceChildren();
    enhancementMessage.hidden = true;

    const scrolls = scrollsByEquipmentKind.get(equipmentKind) ?? [];

    if (scrolls.length === 0) {
      enhancementMessage.textContent = '이 장비 종류에 해당하는 주문서가 없습니다';
      enhancementMessage.hidden = false;
      return;
    }
```

New:

```javascript
  const renderScrollList = (item) => {
    if (!(scrollList instanceof HTMLElement) || !(enhancementMessage instanceof HTMLElement)) {
      return;
    }

    scrollList.replaceChildren();
    enhancementMessage.hidden = true;

    const scrolls = scrollsByEquipmentKind.get(item.equipmentKind) ?? [];

    // Phase 1: filter by item-specific targeting
    const eligible = scrolls.filter(scroll => {
      if (scroll.targetItemId == null) return true;
      return scroll.targetItemId === item.id;
    });

    // Phase 2: filter out scrolls that have reached their max application count
    const available = eligible.filter(scroll => {
      if (scroll.maxApplications == null) return true;
      const applied = enhancementState.scrollState.slots.filter(s => s?.id === scroll.id).length;
      return applied < scroll.maxApplications;
    });

    if (available.length === 0) {
      enhancementMessage.textContent = '이 장비 종류에 해당하는 주문서가 없습니다';
      enhancementMessage.hidden = false;
      return;
    }
```

And update the `forEach` on the next line — change `scrolls.forEach` to `available.forEach`:

**Line ~403:** Change:
```javascript
    scrolls.forEach((scroll) => {
```
To:
```javascript
    available.forEach((scroll) => {
```

**Line ~401:** Change:
```javascript
    scrollList.hidden = false;
```
Is right after the if-block. Keep it as-is.

- [ ] **Step 2: Update the restore-scroll-detail helper that references the old scrolls array**

Inside `showScrollDetail` and the revert logic (around lines 463-468), there's code that finds a scroll in the original `scrolls` array to populate the detail panel. This needs to use `available` instead. However, the `available` array is local to `renderScrollList`. The detail panel uses `scrollsByEquipmentKind` directly. Let me check if `showScrollDetail` accesses the `scrolls` variable…

Actually, looking at the code more carefully: `showScrollDetail` at line ~310-345 takes a `scroll` object directly. It's called from the slot click handler (line 149-153) with the scroll from the slot (`state.slots[i]`), not from the rendered list. So no change needed there.

Looking at lines ~460-468 (the revert/restore logic inside the non-chaos click handler after collapseChaosPanel):

Let me check lines 463-468 context:
```javascript
        // Non-chaos scroll: collapse chaos panel and apply normally
        collapseChaosPanel();

        const applied = applyScroll(enhancementState, scroll);
        if (!applied) {
          return;
        }

        renderSlotRow();
        hideScrollDetail();
        refreshEnhancedCard();
```

`scroll` here is the variable captured from the `available.forEach((scroll) => {` closure — it's the scroll being clicked. No issue.

- [ ] **Step 3: Re-render scroll list after applying a fixed/random scroll**

After `applyScroll` at line 476-483, add a call to re-render the scroll list. Change:

```javascript
        const applied = applyScroll(enhancementState, scroll);
        if (!applied) {
          return;
        }

        renderSlotRow();
        hideScrollDetail();
        refreshEnhancedCard();
```

To:

```javascript
        const applied = applyScroll(enhancementState, scroll);
        if (!applied) {
          return;
        }

        renderSlotRow();
        renderScrollList(selectedBaseItem);
        hideScrollDetail();
        refreshEnhancedCard();
```

- [ ] **Step 4: Re-render scroll list after applying a chaos scroll**

After `applyScroll` at lines 359-366, add the re-render. Change:

```javascript
      const applied = applyScroll(enhancementState, scrollEntry);
      if (!applied) {
        return;
      }

      renderSlotRow();
      hideScrollDetail();
      refreshEnhancedCard();
```

To:

```javascript
      const applied = applyScroll(enhancementState, scrollEntry);
      if (!applied) {
        return;
      }

      renderSlotRow();
      renderScrollList(selectedBaseItem);
      hideScrollDetail();
      refreshEnhancedCard();
```

- [ ] **Step 5: Re-render scroll list after clearing a slot**

In the x-button click handler at lines 122-129, add `renderScrollList(selectedBaseItem)`:

```javascript
        xBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          collapseChaosPanel();
          clearSlot(enhancementState.scrollState, i);
          hideScrollDetail();
          renderSlotRow();
          renderScrollList(selectedBaseItem);
          refreshEnhancedCard();
        });
```

- [ ] **Step 6: Re-render scroll list after full reset**

In the reset button handler at lines 559-565, add `renderScrollList(selectedBaseItem)`:

```javascript
    resetState(enhancementState);
    collapseChaosPanel();
    chaosStepperValues = new Map();
    hideScrollDetail();
    renderSlotRow();
    renderScrollList(selectedBaseItem);
    makerPanel.resetMakerUI();
    refreshEnhancedCard();
```

- [ ] **Step 7: Update the activatePanel2 call site**

At line 549, change:
```javascript
    renderScrollList(item.equipmentKind);
```
To:
```javascript
    renderScrollList(item);
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/enhancementPanel.mjs
git commit -m "feat: filter scrolls by targetItemId and maxApplications, re-render on state change

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: End-to-end verification

- [ ] **Step 1: Verify the generated JSON has Dragon Stone**

```bash
node -e "
const scrolls = require('./public/data/scrolls-gms83-ko.json');
const ds = scrolls.find(s => s.id === 2041200);
console.log('Found:', ds ? 'YES' : 'NO');
console.log('targetItemId:', ds?.targetItemId);
console.log('maxApplications:', ds?.maxApplications);
console.log('nameKo:', ds?.nameKo);
console.log('stats:', JSON.stringify(ds?.stats));
"
```

Expected:
```
Found: YES
targetItemId: 1122000
maxApplications: 1
nameKo: 드래곤의 돌
stats: {"weaponDefense":140,"magicDefense":140,"avoidability":15,"str":15,"dex":15,"int":15,"luk":15}
```

- [ ] **Step 2: Verify existing scrolls have null for new fields**

```bash
node -e "
const scrolls = require('./public/data/scrolls-gms83-ko.json');
const withTarget = scrolls.filter(s => s.targetItemId != null);
const withMax = scrolls.filter(s => s.maxApplications != null);
console.log('Scrolls with targetItemId:', withTarget.length, '(expected: 1)');
console.log('Scrolls with maxApplications:', withMax.length, '(expected: 1)');
"
```

Expected: 1 each (the Dragon Stone). No existing scrolls affected.

- [ ] **Step 3: Build and verify the app works**

```bash
npm run build
```

Expected: build succeeds with no errors.

- [ ] **Step 4: Commit verification notes**

```bash
git add -A
git commit -m "verify: Dragon Stone scroll — end-to-end data pipeline check

Co-Authored-By: Claude <noreply@anthropic.com>"
```
