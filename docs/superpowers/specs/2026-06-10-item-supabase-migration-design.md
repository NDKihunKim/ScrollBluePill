# Item Supabase Migration Design

**Date:** 2026-06-10  
**Status:** Approved  
**Scope:** Migrate item data pipeline from maplestory.io–only to Supabase–backed, mirroring the existing scroll data pattern.

---

## Goal

Store MapleStory equip item definitions in Supabase (`item_definitions` table), then generate the static frontend JSON at build time by fetching from Supabase and applying visibility overrides from the existing JSON config files. The frontend itself requires no changes.

---

## Architecture

Same two-layer pattern as scrolls:

```
maplestory.io API
       │
       ▼
  seed-item-definitions.mjs   ← applies item-overrides.ko.json
       │
       ▼
  Supabase item_definitions   ← RLS: only published rows visible to anon
       │
       ▼
generate-item-index.mjs       ← applies item-visibility-overrides.json + dedupe
       │
       ▼
public/data/items-gms83-ko.json  ← static JSON, loaded by frontend at runtime
```

---

## Database: `public.item_definitions`

```sql
create table if not exists public.item_definitions (
    id integer primary key,
    version_tag_id uuid not null references public.version_tags(id),
    name_ko text not null,
    name_en text,
    equipment_kind text not null,
    required_level integer not null default 0,
    required_jobs text[] not null default '{}',
    requirements jsonb not null default '{}'::jsonb,
    stats jsonb not null default '{}'::jsonb,
    aliases text[] not null default '{}',
    published_status text not null default 'draft'
        check (published_status in ('draft', 'published', 'hidden')),
    source_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.item_definitions enable row level security;

create policy "Public can read published items" on public.item_definitions
    for select using (published_status = 'published');
```

### Column notes

- **`id`** — maplestory.io numeric item ID. Natural, stable key. Used throughout the codebase (`item.id`).
- **`version_tag_id`** — FK to `version_tags`. Ties items to a MapleWorlds version.
- **`requirements`** — JSONB storing `{str, dex, int, luk, pop}`. Only non-zero values present.
- **`stats`** — JSONB storing `{str, dex, int, luk, maxHp, maxMp, weaponAttack, magicAttack, weaponDefense, magicDefense, accuracy, avoidability, speed, jump, attackSpeed, upgradeSlots}`. Only non-zero values present.
- **`aliases`** — Search aliases used by `itemSearch.mjs` for Korean text matching.
- **`published_status`** — `draft` (not exposed), `published` (exposed via RLS), `hidden` (DB-level hide, alternative to JSON override).

---

## Script Pipeline

### 1. `scripts/seed-item-definitions.mjs` (NEW)

**Purpose:** Pull item data from maplestory.io, apply `item-overrides.ko.json`, upsert into Supabase.

**Key:** Requires `SUPABASE_SERVICE_ROLE_KEY` for write access. Uses Supabase REST API with `service_role` key for upserts.

**Steps:**
1. Fetch all equip items from maplestory.io GMS v83 (`/api/GMS/83/item/list?overallCategoryFilter=Equip`)
2. Fetch Korean names from KMS v284 (`/api/KMS/284/item/list?overallCategoryFilter=Equip`)
3. Fetch item details for stats/requirements (GMS v83 `/api/GMS/83/item/{id}`)
4. Load `data/item-overrides.ko.json`
5. For each item: merge API data with overrides to produce the row
6. Upsert into `public.item_definitions` (batch via REST API)
7. Set `published_status = 'published'` by default; the generate script handles further filtering

**Run:** One-time seed, re-run to refresh from upstream. Not part of the build pipeline.

### 2. `scripts/generate-item-index.mjs` (MODIFIED)

**Purpose:** Fetch from Supabase, apply visibility overrides, deduplicate, write static JSON.

**Key:** Uses `SUPABASE_ANON_KEY` (read-only, RLS-filtered). Same env vars as `generate-scroll-index.mjs`.

**Changes from current:**
- Replace `fetchEquipItems()` / `fetchItemDetails()` calls with a Supabase REST fetch to `/rest/v1/item_definitions?select=*`
- Keep the `applyVisibilityOverrides()` step using `data/item-visibility-overrides.json` (unchanged)
- Keep the `dedupeItems()` step (unchanged)
- Keep the report generation (unchanged)
- Remove the maplestory.io API calls for KMS name lookups (those are now done at seed time)

**Output:** `public/data/items-gms83-ko.json` — same format as today.

---

## JSON Config Files (Unchanged)

These files stay exactly as they are. No format changes needed.

### `data/item-overrides.ko.json`

Applied at **seed time**. Provides:

- `nameKo` — override Korean name
- `aliases` — search aliases
- `equipmentKind` — force a specific equipment kind
- `requirements` — merge into API-derived requirements
- `stats` — merge into API-derived stats

### `data/item-visibility-overrides.json`

Applied at **generate time** (build). Provides:

- `hideItemIds` — numeric IDs to exclude from the output
- `hideEquipmentKinds` — equipment kinds to exclude (e.g. `"Medal"`, `"Cash"`)
- `renameById` — display name overrides applied AFTER deduplication (e.g. stat-variant renames like `"루돌프의 빨간코 (STR)"`)

---

## Environment Variables

| Variable | Used by | Notes |
|---|---|---|
| `SUPABASE_URL` | Both scripts | Supabase project URL |
| `SUPABASE_ANON_KEY` | `generate-item-index.mjs` | Read-only, RLS-filtered |
| `SUPABASE_SERVICE_ROLE_KEY` | `seed-item-definitions.mjs` | Write access for upserts |

---

## What Does NOT Change

- **Frontend** (`index.astro`, `itemSearch.mjs`, `maplestoryIo.mjs`) — still loads `items-gms83-ko.json` via `fetch()`, same data shape
- **Visibility override files** — same JSON format, same keys
- **Deduplication** — same algorithm in `src/lib/itemDedupe.mjs`
- **Reports** — same output paths and format
- **`scrolls.json` pipeline** — untouched
- **RLS pattern** — mirrors `scroll_definitions` exactly

---

## Migration Steps (Implementation Plan Preview)

1. Add `item_definitions` table to `supabase/schema.sql`
2. Execute the DDL on the Supabase project
3. Write `scripts/seed-item-definitions.mjs`
4. Run the seed script (populate `item_definitions`)
5. Modify `scripts/generate-item-index.mjs` to read from Supabase
6. Run `generate-item-index` and verify output matches existing `items-gms83-ko.json`
7. Re-run `generate-scroll-index` to confirm no regression
8. Test the frontend locally (`npm run dev`)
