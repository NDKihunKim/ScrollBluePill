import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const seedPath = resolve('data/scroll-seed.json');

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required.');
  console.error('Copy .env.example to .env and fill in your Supabase project credentials.');
  process.exit(1);
}

async function upsertScroll(scroll) {
  const url = new URL('/rest/v1/scroll_definitions', supabaseUrl);
  url.searchParams.set('on_conflict', 'maplestory_io_item_id');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
      'content-type': 'application/json',
      prefer: 'return=representation',
    },
    body: JSON.stringify(scroll),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Supabase API error ${response.status}: ${body}`);
  }

  // 201 = created, 200 = updated (with on_conflict)
  if (response.status === 201 || response.status === 200) {
    return response.json().catch(() => []);
  }

  // 409 with on_conflict returning nothing = conflict resolved with no update needed
  return [];
}

async function fetchVersionTagId() {
  const url = new URL('/rest/v1/version_tags', supabaseUrl);
  url.searchParams.set('select', 'id');
  url.searchParams.set('is_active', 'is.true');
  url.searchParams.set('limit', '1');

  const response = await fetch(url, {
    headers: {
      apikey: supabaseAnonKey,
      authorization: `Bearer ${supabaseAnonKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`Failed to fetch version_tags: ${response.status} ${body}`);
  }

  const tags = await response.json();
  if (!Array.isArray(tags) || tags.length === 0) {
    throw new Error(
      'No active version_tags found in Supabase. Please create at least one version tag before seeding scrolls.'
    );
  }

  return tags[0].id;
}

async function main() {
  const raw = await readFile(seedPath, 'utf8');
  const scrolls = JSON.parse(raw);

  if (!Array.isArray(scrolls) || scrolls.length === 0) {
    console.error('Seed file contains no scrolls. Run generate-scroll-seed first.');
    process.exit(1);
  }

  console.log(`Seeding ${scrolls.length} scrolls to Supabase...`);
  console.log(`Supabase URL: ${supabaseUrl}`);

  // Fetch the version tag to associate scrolls with
  let versionTagId;
  try {
    versionTagId = await fetchVersionTagId();
    console.log(`Using version_tag_id: ${versionTagId}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }

  let inserted = 0;
  let updated = 0;
  let failed = 0;

  for (const scroll of scrolls) {
    const row = {
      version_tag_id: versionTagId,
      name_ko: scroll.name_ko,
      category: scroll.category,
      behavior_type: scroll.behavior_type,
      published_status: scroll.published_status || 'published',
      affected_stats: scroll.affected_stats,
      stat_effect_frame: scroll.stat_effect_frame,
      maplestory_io_item_id: scroll.maplestory_io_item_id,
    };

    try {
      const result = await upsertScroll(row);
      const isInsert = Array.isArray(result) && result.length > 0;
      if (isInsert) {
        inserted++;
        console.log(`  [INSERTED] ${scroll.name_ko} (ID: ${scroll.maplestory_io_item_id})`);
      } else {
        updated++;
        console.log(`  [UPDATED] ${scroll.name_ko} (ID: ${scroll.maplestory_io_item_id})`);
      }
    } catch (error) {
      failed++;
      console.error(`  [FAILED] ${scroll.name_ko}: ${error.message}`);
    }
  }

  console.log(`\nDone. Inserted: ${inserted}, Updated: ${updated}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

await main();
