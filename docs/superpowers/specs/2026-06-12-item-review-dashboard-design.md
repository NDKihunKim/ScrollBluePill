# Item Review Dashboard Design

> **Goal:** Self-contained HTML page that fetches live Supabase item data for admin review with filtering, sorting, and icon display.

## Architecture

Single static HTML file (`outputs/item-review.html`) with embedded CSS/JS. No build step, no server, no framework. Fetches live from Supabase REST API using a browser-localStorage service role key.

## Data Flow

```
Browser opens item-review.html
  → Checks localStorage for service_role_key
  → If missing: shows API key prompt overlay
  → If present: fetches all rows from /rest/v1/item_definitions (paginated, 1000/page)
  → Renders filterable table with icons from MapleStory.io
```

## Features

### Authentication
- On first load, overlay prompts for Supabase service role key
- Key stored in `localStorage` under `supabase_service_role_key`
- "Change key" button in header to re-prompt
- Key never sent anywhere except Supabase REST API

### Summary Bar
- Total item count
- Published / Draft / Hidden counts
- Missing-Korean-name count
- Zero-stat count

### Filters
- **Text search:** Name KO, Name EN, item ID (filters as you type)
- **Equipment kind:** Multi-select dropdown with all 30 kinds
- **Job:** Checkboxes — 전사, 마법사, 궁수, 도적, 해적
- **Status:** Toggle buttons — Published, Draft, Hidden (all on by default)
- **Level:** Min / Max number inputs
- **Korean name:** Has / Missing toggle
- **Stats:** Has / None toggle

### Table
- Columns: Icon (32px), ID, Name KO, Name EN, Equipment Kind, Level, Jobs, Stats summary, Status badge
- Click column header to sort (asc/desc/none)
- Click row to expand: shows full requirements, stats, aliases, source_note, created_at
- Status badge: green=published, yellow=draft, red=hidden
- Icons from MapleStory.io using the same `ICON_ID_OVERRIDES` map from `maplestoryIo.mjs`
- Broken icons shown as placeholder (grey box with `?`)

### Footer
- "Showing X of Y items" count
- Export to CSV button

## Implementation

### Files
- Create: `outputs/item-review.html` — self-contained HTML page
- Modify: `package.json` — add `review:items` script (`open outputs/item-review.html`)

### Technical Notes
- Uses Supabase REST API pagination (1000 rows/page, ~8 requests for 7106 items)
- Icons loaded via `<img>` with lazy loading, error fallback
- Client-side filtering runs on the full dataset in memory
- No external dependencies — vanilla HTML/CSS/JS
- Works in any modern browser, no CORS issues (Supabase REST API allows browser requests)

## Out of Scope
- Editing items (read-only review tool)
- User authentication (single-key model)
- Responsive mobile design (desktop-first admin tool)
