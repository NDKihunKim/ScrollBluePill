// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: process.env.SITE_URL ?? 'https://scrollbluepill.pages.dev',
  integrations: [sitemap()],
  adapter: cloudflare(),
});