# Scroll Review Dashboard — Unified Dashboard Extension

**Date:** 2026-06-13
**Status:** Design approved, awaiting plan

## Overview

Extend the existing Item Review Dashboard (`outputs/item-review.html`) to also handle scrolls from the `scroll_definitions` Supabase table, unified under an Equipment/Scrolls toggle with category-appropriate table columns, filters, and edit forms.

## Architecture

Two files modified, no new files:

| File | Change |
|---|---|
| `scripts/generate-item-review-page.mjs` | Fetch `scroll_definitions` alongside `item_definitions`; embed both as `window.__ITEM_DATA__` and `window.__SCROLL_DATA__` |
| `outputs/item-review.template.html` | Add type toggle, conditional rendering of columns/filters/edit form based on `activeType` state |

The existing `npm run review:items` command continues to work — it now opens a dashboard that covers both equipment items and scrolls.

## Data Model — Scrolls

Scroll fields from `scroll_definitions` and their UI mapping:

| DB Column | UI Label | Table Column | Filterable | Editable |
|---|---|---|---|---|
| `maplestory_io_item_id` | ID | Yes | No | No (read-only) |
| `name_ko` | Name KO | Yes | Text search | Yes |
| `category` | Category | Yes | Dropdown | Yes (dropdown) |
| `behavior_type` | Behavior Type | Yes | Chips | Yes (chips) |
| `published_status` | Status | Yes (badge) | Chips | Yes (chips) |
| `affected_stats` | Affected Stats | Yes (tags) | No | Yes (comma-separated text, like aliases) |
| `stat_effect_frame` | Stat Effect | No (detail row) | Has Stats filter | Yes (key-value number rows, +Add and Remove) |
| `target_item_id` | Target Item | No (detail row) | No | Yes (number input) |
| `max_applications` | Max Apps | No (detail row) | No | Yes (number input) |

**Important:** `id` (UUID, the Supabase primary key) is fetched but not displayed — it is used internally for the PATCH URL (`/rest/v1/scroll_definitions?id=eq.{uuid}`). The displayed ID column is `maplestory_io_item_id` (integer, also used for icon URLs). `affected_stats` is a Postgres text array, edited as comma-separated text (like `aliases` for items). `stat_effect_frame` is a JSONB object with numeric values, edited as key-value number rows.

### Summary Cards (scroll mode)

Total, Published, Draft, Hidden, No Korean Name, No Stats (empty `stat_effect_frame`).

### Filters (scroll mode)

- Text search (name or ID)
- Category dropdown
- Behavior Type chips: Fixed / Random
- Status chips: Published / Draft / Hidden
- Korean Name chips: All / Has / Missing
- Has Stats chips: All / Has / None

### Sortable Columns (scroll mode)

ID, Name KO, Category, Status. (Behavior Type excluded — too few values.)

### Icons

Fetched from `https://maplestory.io/api/GMS/83/item/{maplestory_io_item_id}/icon` — same API as equipment items.

## UI/UX Design

### Type Toggle

A two-segment button in the header:
- **Equipment** (default) — shows item_definitions data
- **Scrolls** — shows scroll_definitions data

Active segment is filled with `--blue`. Switching resets to page 1.

### Table Columns — Equipment (unchanged)

Icon | ID | Name KO | Name EN | Kind | Lv | Jobs | Stats | Status | Edit

### Table Columns — Scrolls

Icon | ID | Name KO | Category | Behavior Type | Affected Stats | Status | Edit

Behavior Type rendered as small tag: "fixed" (blue), "random" (green).
Affected Stats rendered as stat-tags (max 4 shown, "+N more" overflow).

### Edit Modal — Scrolls

Fields:
- **Name KO** — text input
- **Category** — dropdown (populated from all known categories in the data)
- **Behavior Type** — chips: Fixed / Random (mutually exclusive)
- **Status** — chips: Published / Draft / Hidden (mutually exclusive)
- **Stat Effect Frame** — key-value number rows with +Add and Remove buttons
- **Affected Stats** — comma-separated text input (like aliases)
- **Target Item ID** — number input
- **Max Applications** — number input

Save PATCHes to `/rest/v1/scroll_definitions?id=eq.{uuid}`. On success, the embedded `__SCROLL_DATA__` array is updated in-place and the table re-renders.

### Key Storage

The same `supabase_edit_key` stored in localStorage works for both tables — no separate key prompt needed. Key verification is done against `item_definitions` (if the key works there, it works for `scroll_definitions` too).

### Pagination, Sorting, CSV Export

All work identically for both types, driven by the active dataset and column set.

## Error Handling

- Same API key validation flow (verify key against item_definitions first — if it works, it works for scroll_definitions too)
- Edit failures shown as red feedback text in the modal
- Network errors during fetch shown as inline error messages in the table body

## Non-Goals

- No changes to the Astro frontend app
- No changes to `scripts/generate-scroll-index.mjs` or `scripts/review-scroll-status.mjs`
- No new npm scripts
- No database schema changes
