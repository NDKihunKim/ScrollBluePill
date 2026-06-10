# Supabase Scroll Integration Design

**Date:** 2026-06-10
**Status:** approved

## Goal

Replace the attempted Supabase scroll integration with a working one: Supabase is the source of truth for which scrolls are visible and their metadata/stats, while maplestory.io provides only scroll icons. The generation script produces a frontend-ready JSON file that the enhancement panel already knows how to consume.

## Architecture

```
maplestory.io (scroll item icons only)
       +
Supabase scroll_definitions (allowlist + metadata + stats)
       ↓
generate-scroll-index.mjs (merge + transform)
       ↓
public/data/scrolls-gms83-ko.json (frontend-ready format)
       ↓
enhancementPanel.mjs (fetch + display, already works)
```

## Components

### 1. Supabase Schema Change

Add a `maplestory_io_item_id` column to `scroll_definitions` so each scroll row can reference its maplestory.io item for icon retrieval:

```sql
ALTER TABLE public.scroll_definitions
  ADD COLUMN IF NOT EXISTS maplestory_io_item_id INTEGER;
```

The existing columns (`name_ko`, `category`, `behavior_type`, `affected_stats`, `stat_effect_frame`, `published_status`) remain as the authoritative source for all non-icon scroll data.

### 2. Seed Data: `data/scroll-seed.json`

A JSON file containing the initial set of scroll definitions. Each entry maps a Supabase row:

```json
[
  {
    "name_ko": "장갑 공격력 주문서 60%",
    "category": "장갑",
    "behavior_type": "random",
    "maplestory_io_item_id": 2040801,
    "affected_stats": ["weaponAttack"],
    "stat_effect_frame": { "weaponAttack": 2 },
    "published_status": "published"
  }
]
```

- `category` maps to the frontend `equipmentKind` (e.g., "장갑", "한손검", "망토")
- `stat_effect_frame` holds the actual stat deltas applied when the scroll is used
- `maplestory_io_item_id` is the numeric item ID on maplestory.io used to build icon URLs

### 3. Seed Script: `scripts/seed-scrolls.mjs`

Reads `data/scroll-seed.json` and inserts (or upserts) rows into the Supabase `scroll_definitions` table via the REST API. Uses `maplestory_io_item_id` as the conflict key to make re-runs safe.

### 4. Updated `scripts/generate-scroll-index.mjs`

Changes from current behavior:

- **Output path** changes from `public/data/scrolls.json` to `public/data/scrolls-gms83-ko.json` (matches what the frontend fetches)
- **Transform step** converts Supabase rows to frontend format:
  - `id` ← `maplestory_io_item_id` (numeric, for icon lookup)
  - `nameKo` ← `name_ko`
  - `equipmentKind` ← `category`
  - `stats` ← `stat_effect_frame`
  - `behavior_type` preserved
- Visibility overrides from `data/scroll-visibility-overrides.json` still apply on top

### 5. Frontend

No changes needed. `enhancementPanel.mjs` already:

- Fetches `/data/scrolls-gms83-ko.json` (line 234)
- Groups scrolls by `equipmentKind` (lines 245-251)
- Calls `buildItemIconUrl(scroll.id)` for icons (line 138)
- Calls `formatScrollStatLine(scroll)` which reads `scroll.stats` (line 151)
- Accesses `scroll.nameKo` for display (line 147)

Once the generated file has the right format with valid maplestory.io item IDs and populated stats, the panel works end-to-end.

## Data Flow (Generation Time)

1. Script fetches published scrolls from Supabase REST API (`/rest/v1/scroll_definitions?select=*`)
2. RLS ensures only `published_status = 'published'` rows are returned
3. Visibility overrides file removes any IDs/categories/behavior types marked hidden, applies renames
4. Each row is transformed to frontend format (snake_case → camelCase, `category` → `equipmentKind`, `stat_effect_frame` → `stats`, `maplestory_io_item_id` → `id`)
5. Result is sorted by `nameKo` and written to `public/data/scrolls-gms83-ko.json`
6. Visibility report written to `docs/data-quality/scroll-visibility-report.md`

## Error Handling

- If Supabase is unreachable, the generation script fails with a clear error (existing behavior)
- If `maplestory_io_item_id` is null for a published scroll, the script logs a warning and skips the row (icon would 404)
- Seed script logs each insert result and exits non-zero on failure

## Testing

- Manually verify the seed script inserts rows correctly via Supabase dashboard
- Run `generate:scroll-index` and verify the output file has the expected format
- Run `astro dev` and confirm scrolls appear in the enhancement panel with correct names, stats, and icons
