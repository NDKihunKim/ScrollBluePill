# Item Review Dashboard — Edit Feature Design

> Add inline editing capability to the item review dashboard. Select items, edit fields in a modal, save changes directly to Supabase.

## Architecture

Same single-file HTML (`outputs/item-review.html`) generated from template. Browser-side JavaScript handles all editing via Supabase REST API PATCH requests. No server, no build step.

## Data Flow

```
Dashboard loads embedded data (fast browse)
  → Click ✏️ on row
  → Modal fetches LIVE item from Supabase (GET by id)
  → User edits fields in modal
  → Click Save
  → PATCH /rest/v1/item_definitions?id=eq.{id}
  → On success: update embedded data, close modal, show toast
  → On error: show error in modal
```

## Features

### Authentication
- Service role key prompt on first edit attempt (stored in localStorage)
- Key sent as `apikey` + `Authorization: Bearer` header on GET/PATCH

### Edit Modal
- Triggered by ✏️ button on each table row
- Fetches latest item from Supabase before showing (avoids stale data conflicts)
- Editable fields:
  - `nameKo` — text input
  - `nameEn` — text input
  - `equipmentKind` — dropdown of all 30 kinds
  - `requiredLevel` — number input (min 0)
  - `requiredJobs` — checkbox chips
  - `publishedStatus` — radio buttons
  - `stats` — dynamic key-value rows (add/remove keys)
  - `requirements` — dynamic key-value rows
  - `aliases` — comma-separated text
- Save button → builds a sparse PATCH payload (only changed fields)
- Cancel button → closes modal without saving
- Loading spinner while fetching
- Success/error feedback

### Safety
- Fetches fresh data before showing (not stale from embedded)
- Sends only changed fields (no accidental overwrites)
- Max 5 retries on network failure
- Visual feedback: green toast on success, red text on error

## Implementation

### Files
- Modify: `outputs/item-review.template.html` — add modal HTML, CSS, edit JS
- Regenerate: `outputs/item-review.html`

### Notes
- Service role key required for editing (anon key is read-only)
- Key prompt shown only on first edit attempt, not on page load
- Embedded data stays read-only for browsing — modal fetches live
