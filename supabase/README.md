# Supabase Frames

`schema.sql` defines the first-pass data frames only. It does not encode the final
scroll calculation model.

Tables:

- `version_tags`
- `scroll_definitions`
- `item_categories`
- `probability_sets`
- `guide_content`

RLS is enabled on every public table. Policies should be added after the actual
read/write access model is decided.
