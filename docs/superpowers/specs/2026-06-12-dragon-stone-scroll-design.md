# Dragon Stone Scroll — Design Spec

**Date:** 2026-06-12
**Status:** approved
**Item:** Dragon Stone (maplestory.io ID: 2041200), Horntail Necklace (ID: 1122000)

## Overview

Add the Dragon Stone scroll to the ScrollBluePill website. The Dragon Stone:
- Works **only** on Horntail Necklace (item ID 1122000)
- Can be applied **once** per item
- Has 100% success rate (fixed behavior)
- Grants: weaponDefense +140, magicDefense +140, avoidability +15, STR/DEX/INT/LUK +15

This requires introducing two new concepts to the codebase: **item-specific targeting** (`target_item_id`) and **per-scroll application limit** (`max_applications`).

## Architecture

```
Supabase (scroll_definitions)
    │  INSERT dragon stone row with target_item_id + max_applications
    │  ALTER TABLE to add new columns
    ▼
scripts/generate-scroll-index.mjs
    │  transformToFrontendSchema — pass through targetItemId, maxApplications
    ▼
public/data/scrolls-gms83-ko.json
    │  frontend scroll entries with new optional fields
    ▼
src/lib/enhancementPanel.mjs
    │  filter by targetItemId (item match)
    │  filter by maxApplications (count applied < max)
    ▼
src/lib/scrollState.mjs
    │  applyScroll rejects if maxApplications reached
    ▼
UI: scroll disappears from list when fully consumed
```

## Changes

### 1. Database — `supabase/schema.sql`

Add two nullable columns to `scroll_definitions`:

```sql
ALTER TABLE public.scroll_definitions
  ADD COLUMN IF NOT EXISTS maplestory_io_item_id integer;

ALTER TABLE public.scroll_definitions
  ADD COLUMN IF NOT EXISTS target_item_id integer;

ALTER TABLE public.scroll_definitions
  ADD COLUMN IF NOT EXISTS max_applications integer;
```

- `maplestory_io_item_id` — already exists in live DB, missing from schema.sql (backfill)
- `target_item_id` — NULL = works on all items of the category; set = only works on that specific item
- `max_applications` — NULL = unlimited; set = maximum times this scroll can be applied to one item

**Dragon Stone INSERT:**

```sql
INSERT INTO public.scroll_definitions
  (version_tag_id, name_ko, category, behavior_type, published_status,
   affected_stats, stat_effect_frame,
   maplestory_io_item_id, target_item_id, max_applications, source_note)
VALUES
  ((SELECT id FROM version_tags WHERE is_active = true LIMIT 1),
   '드래곤의 돌 100%', '펜던트', 'fixed', 'published',
   ARRAY['weaponDefense','magicDefense','avoidability','str','dex','int','luk'],
   '{"weaponDefense":140,"magicDefense":140,"avoidability":15,"str":15,"dex":15,"int":15,"luk":15}',
   2041200, 1122000, 1,
   'Dragon Stone — Horntail Necklace only, once per item');
```

Note: name includes "100%" suffix to pass the `filterDesiredPercentScrolls` gate in the generation script.

### 2. Pipeline — `scripts/generate-scroll-index.mjs`

**`transformToFrontendSchema`** — add two fields:

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

Re-run after the Supabase INSERT:
```bash
node scripts/generate-scroll-index.mjs
```

### 3. Scroll State — `src/lib/scrollState.mjs`

**`applyScroll`** — reject when max reached:

In the `applyScroll(state, scroll)` function, before placing the scroll at the current slot, add:

```javascript
if (scroll.maxApplications != null) {
    const count = state.slots.filter(s => s?.id === scroll.id).length;
    if (count >= scroll.maxApplications) {
        return false;
    }
}
```

### 4. Enhancement Panel — `src/lib/enhancementPanel.mjs`

**`renderScrollList`** — two-phase filter after `equipmentKind` lookup:

```javascript
const scrolls = scrollsByEquipmentKind.get(equipmentKind) ?? [];

// Phase 1: filter by item-specific targeting
const eligible = scrolls.filter(scroll => {
    if (scroll.targetItemId == null) return true;
    return scroll.targetItemId === item.id;
});

// Phase 2: filter out scrolls that have reached their max application count
const available = eligible.filter(scroll => {
    if (scroll.maxApplications == null) return true;
    const applied = scrollState.slots.filter(s => s?.id === scroll.id).length;
    return applied < scroll.maxApplications;
});
```

The `renderScrollList` function signature changes to accept the full item object (not just `equipmentKind` string) to access `item.id` for the targetItemId check.

### 5. Item Data — `public/data/items-gms83-ko.json`

The Horntail Necklace (ID 1122000) already exists in the item index with:
- `equipmentKind`: `"펜던트"`
- `requiredLevel`: 120
- 3 upgrade slots

No changes needed to item data.

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Dragon Stone applied to slot 1 of Horntail Necklace | ✅ Succeeds, scroll disappears from list |
| User tries to apply Dragon Stone a second time | ❌ Rejected by `applyScroll` returning false; scroll already hidden from list |
| User reverts slot 1 after applying Dragon Stone | Dragon Stone reappears in list, can be re-applied |
| User selects a non-Horntail-Necklace pendant | Dragon Stone not shown in scroll list (targetItemId mismatch) |
| Existing scrolls (targetItemId=null, maxApplications=null) | No behavior change |

## Testing

- Insert Dragon Stone into Supabase
- Run `generate-scroll-index.mjs` — verify entry appears in JSON with `targetItemId: 1122000, maxApplications: 1`
- UI: select Horntail Necklace → verify Dragon Stone appears in scroll list
- UI: apply Dragon Stone → verify it disappears from list
- UI: revert slot → verify Dragon Stone reappears
- UI: select a different pendant → verify Dragon Stone NOT in list
