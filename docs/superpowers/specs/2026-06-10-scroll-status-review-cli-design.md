# Scroll Status Review CLI Design

## Goal

Create a local admin command-line workflow for manually reviewing scrolls stored in Supabase by category and changing their `published_status` both ways between `published`, `hidden`, and `draft`.

The purpose is to hide outdated, event-only, or newly imported scrolls from users without relying on local JSON visibility overrides. Supabase remains the source of truth for public visibility.

## Current Context

- Scroll records live in `public.scroll_definitions`.
- `public.scroll_definitions.published_status` already supports `draft`, `published`, and `hidden`.
- RLS currently exposes only `published` scrolls through the public anon read policy.
- `scripts/generate-scroll-index.mjs` fetches scroll definitions through Supabase REST and reports that the returned data is RLS-filtered to published rows.
- `data/scroll-visibility-overrides.json` exists, but this workflow should not use it for hiding reviewed scrolls.

One existing mismatch is out of scope for this design: the generator writes `public/data/scrolls.json`, while the enhancement panel currently fetches `public/data/scrolls-gms83-ko.json`. The status review CLI should update Supabase only; generated file naming can be handled separately if needed.

## User Workflow

Add a Node script, exposed as:

```bash
npm run review:scrolls
```

The script should:

1. Load `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` from `.env`.
2. Fetch all rows from `public.scroll_definitions`, including `draft`, `published`, and `hidden`.
3. Group scrolls by `category`.
4. Prompt the admin to choose one category.
5. Display every scroll in that category with:
   - display number
   - `id`
   - `name_ko`
   - `behavior_type`
   - current `published_status`
   - `affected_stats`
6. Accept selected scrolls by display number or UUID.
7. Accept a target status of `published`, `hidden`, or `draft`.
8. Show a confirmation summary before writing.
9. Update only `published_status` in Supabase.
10. Refetch updated rows and print the resulting statuses.

The command is local/admin-only. No browser code should import or expose the service role key.

## Selection Input

The script should support practical terminal input:

- Single display numbers: `4`
- Comma-separated numbers: `1,3,7`
- Ranges: `2-5`
- Mixed input: `1,3-5,9`
- UUIDs copied from the displayed table

Duplicate selections should collapse to one update per scroll. Invalid numbers, unknown UUIDs, empty selections, and malformed ranges should produce clear errors before any write.

## Supabase Access

Use Supabase REST with `SUPABASE_SERVICE_ROLE_KEY` because the script needs to read and update all statuses, not only public `published` rows.

The script must fail before making any request if:

- `SUPABASE_URL` is missing.
- `SUPABASE_SERVICE_ROLE_KEY` is missing.

The script should not use `SUPABASE_ANON_KEY` for this workflow.

## Safety

The script must be conservative:

- No write occurs until the admin confirms the exact selected scrolls and target status.
- Allowed statuses are only `published`, `hidden`, and `draft`.
- The update payload must only contain `published_status`.
- The script should print how many rows Supabase reports as updated.
- The script should refetch selected IDs after the update and display final statuses.
- Automated tests must not perform real Supabase writes.

## Data Flow

1. CLI starts and validates environment variables.
2. CLI fetches all scroll rows using the service role key.
3. CLI groups rows by `category` and sorts categories using Korean locale-aware ordering.
4. Admin chooses a category.
5. CLI sorts that category's scrolls by `name_ko`, then displays them.
6. Admin selects rows and a target status.
7. CLI validates selection and target status.
8. CLI shows a confirmation summary.
9. On confirmation, CLI sends an update request for selected IDs:
   - table: `public.scroll_definitions`
   - field changed: `published_status`
10. CLI refetches selected IDs and prints the final state.

## Error Handling

Handle only realistic local-admin failures:

- Missing environment variables.
- Supabase REST non-2xx responses.
- Empty database result.
- Category choice outside the displayed range.
- Invalid selection input.
- Target status outside the allowed set.
- Confirmation declined.

Confirmation declined should exit cleanly without treating it as an error.

## Testing

Add focused tests without touching the live database:

1. Parsing tests for number lists, ranges, UUIDs, duplicates, and invalid selections.
2. Contract tests that inspect the script source for the important safety properties:
   - uses `SUPABASE_SERVICE_ROLE_KEY`
   - does not use `SUPABASE_ANON_KEY` for this workflow
   - permits only `published`, `hidden`, and `draft`
   - sends update payloads containing only `published_status`
3. Runtime smoke verification with a help or dry-run-safe path that does not update Supabase.

## Non-Goals

- No internal web admin page.
- No public user-facing UI changes.
- No local JSON visibility override changes.
- No schema changes.
- No automated database writes in tests.
- No bulk import or scroll data editing beyond `published_status`.
