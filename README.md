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
  - `SITE_URL=https://paranpot.com`

The `sync:data` step in `npm run build` skips gracefully when Supabase
credentials aren't available (CI), relying on committed data files in
`public/data/`. When you update item or scroll data locally, run
`npm run sync:data` first, verify the changes, then commit the updated JSON
files — Cloudflare will pick them up on the next deploy.

**Do NOT add `SUPABASE_URL`, `SUPABASE_ANON_KEY`, or `SUPABASE_SERVICE_ROLE_KEY`
to Cloudflare Pages environment variables.** The anon key is safe to expose
but unnecessary for the CI build. The service role key should only exist in
your local `.env` file.

## License

ScrollBluePill is proprietary software. All rights reserved.

This source code is provided for reference purposes only. No permission is
granted to use, copy, modify, merge, publish, distribute, sublicense, or sell
copies of this software. See [LICENSE](./LICENSE).

---

Test commit to verify author configuration.
