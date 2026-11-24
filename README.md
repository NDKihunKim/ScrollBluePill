# ScrollBluePill

**The codebase behind [paranpot.com](https://paranpot.com)** - a Korean-first
expected-value and strategy calculator for MapleStory item enhancement.

ScrollBluePill models the probability and expected cost of enhancement paths,
ranks candidate strategies, and helps players compare options before
committing in-game resources. The production site is a static Astro build
served from Cloudflare Pages: the browser never queries the database at
runtime.

## Live site

- https://paranpot.com

## Features

- **Expected-value engine** covering multiple enhancement paths, with a
  strategy optimizer and candidate generator that ranks outcomes for users.
- **In-browser OCR** (Korean and English, Tesseract.js) so users can upload a
  screenshot instead of entering item data by hand, removing the primary
  source of input error.
- **Shareable strategy links** that reconstruct exact application state from a
  URL payload.
- **Static data pipeline**: Supabase/PostgreSQL is the authoring source; build
  scripts export seeded, deduplicated JSON so the deployed site serves zero
  runtime database queries.
- **34 automated test suites** (`node:test`), with Playwright used in
  browser-level tests and Lighthouse CI wired into GitHub Actions.
- **Production operations**: `/healthz` health-check endpoint, uptime
  monitoring, Cloudflare Web Analytics, SEO sitemap, and a sitemap index.

## Stack

| Layer | Technology |
| --- | --- |
| Site | Astro, TypeScript, vanilla JS |
| Data | Supabase/PostgreSQL, static JSON build pipeline |
| OCR | Tesseract.js (Korean and English) |
| Hosting | Cloudflare Pages |
| Testing | `node:test` (34 suites), Playwright |
| CI | GitHub Actions (Lighthouse CI) |

## Architecture

```text
Supabase/PostgreSQL  ->  build scripts  ->  public/data/*.json
                                                |
                                           Astro static build
                                                |
                                          Cloudflare Pages  ->  browser
                                                                   |
                                                           Tesseract.js OCR
```

Only the build scripts (`scripts/seed-*`, `scripts/generate-*`,
`scripts/sync-data.mjs`) talk to Supabase. The browser reads static JSON and
runs OCR locally.

## Local development

```bash
npm install
cp .env.example .env      # fill in Supabase project values
npm run dev               # Astro dev server
```

Data maintenance (requires Supabase credentials in `.env`):

```bash
npm run seed:items
npm run seed:item-level-ups
npm run generate:item-index
npm run generate:scroll-index
npm run sync:data
```

Tests and checks:

```bash
npm test                  # 34 node:test suites
npm run lint
npm run format:check
npm run lhci              # Lighthouse CI against a built site
```

Production build:

```bash
npm run build             # syncs OCR assets and static data, then astro build
```

## Deployment

Cloudflare Pages builds the site from `main`. `SITE_URL` defaults to
`https://paranpot.com` in `astro.config.mjs`. Do not add the Supabase
service-role key to Cloudflare Pages environment variables; the deploy needs
only the committed static data.

## Data attribution

Item metadata is fetched through the [maplestory.io](https://maplestory.io)
API. MapleStory is a trademark of Nexon. This project is not affiliated with
or endorsed by Nexon.

## License

Proprietary. All rights reserved. See [LICENSE](./LICENSE).
