# ScrollBluePill

Korean-first MapleWorlds old-school scroll probability tool planned for
Cloudflare Pages with Supabase data frames.

## Project Scope

- Cloudflare Pages static site
- Korean calculator shell
- SEO-ready guide, methodology, privacy, terms, and contact pages
- Supabase table frames for scroll definitions, item categories, probability
  sets, version tags, and guide content
- Probability engine output contract only

The actual calculation inputs and formulas are intentionally not implemented
yet.

## Commands

```sh
npm run dev
npm run build
npm run preview
```

### Data Sync

```sh
npm run sync:data
```

Regenerates all static JSON data files from Supabase:

- `public/data/items-gms83-ko.json`
- `public/data/scrolls-gms83-ko.json`
- `public/data/item-level-ups-gms83-ko.json`

**When to run:** After editing items or scrolls in the review dashboard
(`npm run review:items`), run `npm run sync:data` so the main app sees your
changes. The dashboard edits Supabase directly; the main app reads from these
generated JSON files.

`npm run build` runs `sync:data` automatically before building.

Requires `SUPABASE_URL` and `SUPABASE_ANON_KEY` in `.env`.

## Cloudflare Pages

Use these settings:

- Framework preset: `Astro`
- Build command: `npm run build`
- Build output directory: `dist`
- Environment variables:
  - `SITE_URL=https://your-domain.example`
  - `SUPABASE_URL` — your Supabase project URL
  - `SUPABASE_ANON_KEY` — your Supabase anon key (safe to expose)

The `sync:data` step in the build requires `SUPABASE_URL` and
`SUPABASE_ANON_KEY`. The `.env` file is not committed; set these in the
Cloudflare Pages dashboard instead.

If no custom domain is ready, the config falls back to
`https://scrollbluepill.pages.dev`.

---

Test commit to verify author configuration.
