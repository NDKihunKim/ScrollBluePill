import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const REGION = 'GMS';
const VERSION = '83';
const BASE_URL = 'https://maplestory.io';
const OUTPUT_PATH = resolve('data/scroll-seed.json');
const DETAIL_CONCURRENCY = 12;

// Map maplestory.io subCategory → frontend equipmentKind (Korean)
const equipmentKindBySubCategory = {
  Gloves: '장갑',
  Cape: '망토',
  Overall: '한벌옷',
  Topwear: '상의',
  Bottomwear: '하의',
  Helmet: '모자',
  Shoes: '신발',
  Shield: '방패',
  Earrings: '귀고리',
  Face: '얼굴장식',
  Eye: '눈장식',
  Belts: '벨트',
  Ring: '반지',
  Pendant: '펜던트',
  'One-Handed Sword': '한손검',
  'Two-Handed Sword': '두손검',
  'One-Handed Axe': '한손도끼',
  'Two-Handed Axe': '두손도끼',
  'One-Handed BW': '한손둔기',
  'Two-Handed BW': '두손둔기',
  Spear: '창',
  Polearm: '폴암',
  Wand: '완드',
  Staff: '스태프',
  Bow: '활',
  Crossbow: '석궁',
  Claw: '아대',
  Dagger: '단검',
  Knuckle: '너클',
  Gun: '총',
};

// Map metaInfo stat fields → frontend stat keys
const statFieldMap = {
  incPAD: 'weaponAttack',
  incMAD: 'magicAttack',
  incSTR: 'str',
  incDEX: 'dex',
  incINT: 'int',
  incLUK: 'luk',
  incPDD: 'weaponDefense',
  incMDD: 'magicDefense',
  incACC: 'accuracy',
  incEVA: 'avoidability',
  incSpeed: 'speed',
  incJump: 'jump',
  incMHP: 'maxHp',
  incMMP: 'maxMp',
};

// Korean labels for stat types (used in name construction)
const statLabelKo = {
  weaponAttack: '공격력',
  magicAttack: '마력',
  str: '힘',
  dex: '민첩성',
  int: '지력',
  luk: '행운',
  weaponDefense: '방어력',
  magicDefense: '마법방어력',
  accuracy: '명중률',
  avoidability: '회피율',
  speed: '이동속도',
  jump: '점프력',
  maxHp: 'HP',
  maxMp: 'MP',
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function fetchAllScrolls(categoryFilter) {
  const countUrl = new URL(`/api/${REGION}/${VERSION}/item/count`, BASE_URL);
  countUrl.searchParams.set('overallCategoryFilter', 'Use');
  countUrl.searchParams.set('categoryFilter', categoryFilter);

  const total = await fetchJson(countUrl);
  console.log(`  ${categoryFilter}: ${total} items`);

  const listUrl = new URL(`/api/${REGION}/${VERSION}/item/list`, BASE_URL);
  listUrl.searchParams.set('startPosition', '0');
  listUrl.searchParams.set('count', String(total));
  listUrl.searchParams.set('overallCategoryFilter', 'Use');
  listUrl.searchParams.set('categoryFilter', categoryFilter);

  return fetchJson(listUrl);
}

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

function extractStats(metaInfo = {}) {
  const stats = {};
  for (const [metaKey, statKey] of Object.entries(statFieldMap)) {
    const value = metaInfo[metaKey];
    if (Number.isFinite(value) && value !== 0) {
      stats[statKey] = value;
    }
  }
  return stats;
}

function guessBehaviorType(name) {
  const n = name.toLowerCase();
  if (n.includes('100%')) return 'fixed';
  if (n.includes('10%') || n.includes('30%') || n.includes('60%') || n.includes('70%') || n.includes('15%') || n.includes('65%')) return 'random';
  if (n.includes('dark scroll')) return 'random';
  if (n.includes('50%')) return 'random';
  // Older scrolls without % marker — check naming pattern
  // In old GMS, scrolls without % are typically 100% (fixed)
  if (!/\d+%/.test(n)) return 'fixed';
  return 'unknown';
}

function extractSuccessRate(name) {
  const match = name.match(/(\d+)%/);
  return match ? `${match[1]}%` : null;
}

function constructKoreanName(englishName, equipmentKind, stats) {
  // Parse the English name to extract: target equipment, stat, and success rate
  const rate = extractSuccessRate(englishName);

  // Determine the primary stat from the stats object
  const statEntries = Object.entries(stats);
  if (statEntries.length === 0) return englishName; // fallback

  // Try to identify the primary stat from the name
  const nameLower = englishName.toLowerCase();

  // Stat name detection from English name
  const statPatterns = [
    { keys: ['weaponAttack', 'magicAttack'], patterns: ['att', 'attack', 'atk'] },
    { keys: ['magicAttack'], patterns: ['magic att', 'magic atk', 'm.att', 'm.atk', 'magic attack'] },
    { keys: ['weaponAttack'], patterns: ['weapon att', 'weapon atk'] },
    { keys: ['str'], patterns: ['str'] },
    { keys: ['dex'], patterns: ['dex'] },
    { keys: ['int'], patterns: ['int'] },
    { keys: ['luk'], patterns: ['luk'] },
    { keys: ['weaponDefense'], patterns: ['weapon def', 'w.def', 'def'] },
    { keys: ['magicDefense'], patterns: ['magic def', 'm.def', 'magic def.'] },
    { keys: ['accuracy'], patterns: ['accuracy', 'acc'] },
    { keys: ['avoidability'], patterns: ['avoid', 'avoidability'] },
    { keys: ['speed'], patterns: ['speed'] },
    { keys: ['jump'], patterns: ['jump'] },
    { keys: ['maxHp'], patterns: ['hp', 'maxhp'] },
    { keys: ['maxMp'], patterns: ['mp', 'maxmp'] },
  ];

  let primaryStatKey = statEntries[0][0]; // default to first stat

  for (const { keys, patterns } of statPatterns) {
    if (patterns.some((p) => nameLower.includes(p))) {
      // Find which of these keys actually has a value in stats
      const matchingKey = keys.find((k) => stats[k] != null);
      if (matchingKey) {
        primaryStatKey = matchingKey;
        break;
      }
    }
  }

  const statLabel = statLabelKo[primaryStatKey] || primaryStatKey;
  const kind = equipmentKind;

  let name = `${kind} ${statLabel} 주문서`;
  if (rate) {
    name = `${name} ${rate}`;
  }

  return name;
}

async function main() {
  console.log('Fetching scroll items from maplestory.io...');

  // Fetch both armor and weapon scrolls
  const [armorScrolls, weaponScrolls] = await Promise.all([
    fetchAllScrolls('Armor Scroll'),
    fetchAllScrolls('Weapon Scroll'),
  ]);

  const allScrolls = [...armorScrolls, ...weaponScrolls];
  console.log(`Total scroll items: ${allScrolls.length}`);

  // Filter: only include scrolls for equipment kinds we support
  const supportedScrolls = allScrolls.filter((item) => {
    const subCat = item.typeInfo?.subCategory;
    return equipmentKindBySubCategory[subCat] != null;
  });
  console.log(`Supported scrolls (matching equipment kinds): ${supportedScrolls.length}`);

  // Filter out event/anniversary scrolls and other noise
  const filteredScrolls = supportedScrolls.filter((item) => {
    const name = item.name || '';
    // Skip clearly non-standard scrolls
    if (name.includes('[4yrAnniv]')) return false;
    if (name.includes('Red-Nose')) return false;
    if (name.includes('Rudolph')) return false;
    if (name.includes('Dragon Stone')) return false;
    if (name.includes('Spiegelmann')) return false;
    if (name.includes('Rock of Wisdom')) return false;
    if (name.includes('Miwok')) return false;
    if (name.includes('Balrog')) return false;
    if (name.includes('King Pepe')) return false;
    if (name.includes('Cold Protection')) return false;
    return true;
  });
  console.log(`After filtering event/special scrolls: ${filteredScrolls.length}`);

  // Fetch details for each scroll to get stat values
  console.log(`Fetching details for ${filteredScrolls.length} scrolls (concurrency: ${DETAIL_CONCURRENCY})...`);
  let completed = 0;

  const withDetails = await mapWithConcurrency(filteredScrolls, DETAIL_CONCURRENCY, async (item) => {
    const detailUrl = new URL(`/api/${REGION}/${VERSION}/item/${item.id}`, BASE_URL);
    let detail = null;
    try {
      detail = await fetchJson(detailUrl);
    } catch (error) {
      console.warn(`  Failed to fetch detail for ${item.id}: ${error.message}`);
    }
    completed += 1;
    if (completed % 100 === 0 || completed === filteredScrolls.length) {
      console.log(`  Fetched details: ${completed}/${filteredScrolls.length}`);
    }
    return { item, detail };
  });

  // Build seed entries
  const seedEntries = [];
  const skippedNoStats = [];
  const skippedNoKind = [];

  for (const { item, detail } of withDetails) {
    if (!detail) continue;

    const equipmentKind = equipmentKindBySubCategory[item.typeInfo?.subCategory];
    if (!equipmentKind) {
      skippedNoKind.push(item.id);
      continue;
    }

    const stats = extractStats(detail.metaInfo);
    if (Object.keys(stats).length === 0) {
      skippedNoStats.push({ id: item.id, name: item.name });
      continue;
    }

    const englishName = item.name;
    const koreanName = constructKoreanName(englishName, equipmentKind, stats);
    const behaviorType = guessBehaviorType(englishName);

    const affectedStats = Object.keys(stats);

    seedEntries.push({
      name_ko: koreanName,
      category: equipmentKind,
      behavior_type: behaviorType,
      maplestory_io_item_id: item.id,
      affected_stats: affectedStats,
      stat_effect_frame: stats,
      published_status: 'published',
    });
  }

  // Sort by equipment kind, then name
  seedEntries.sort((a, b) => {
    const kindCmp = a.category.localeCompare(b.category, 'ko-KR');
    if (kindCmp !== 0) return kindCmp;
    return a.name_ko.localeCompare(b.name_ko, 'ko-KR');
  });

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(seedEntries, null, 2)}\n`);

  console.log(`\nGenerated ${OUTPUT_PATH} with ${seedEntries.length} scroll entries.`);
  if (skippedNoStats.length > 0) {
    console.log(`Skipped ${skippedNoStats.length} scrolls with no stats.`);
    console.log(`  First few: ${skippedNoStats.slice(0, 5).map((s) => `${s.id} ${s.name}`).join(', ')}`);
  }
  if (skippedNoKind.length > 0) {
    console.log(`Skipped ${skippedNoKind.length} scrolls with no equipment kind mapping.`);
  }

  // Summary by category
  const byCategory = new Map();
  for (const entry of seedEntries) {
    const count = byCategory.get(entry.category) || 0;
    byCategory.set(entry.category, count + 1);
  }
  console.log('\nScrolls by equipment kind:');
  for (const [kind, count] of [...byCategory].sort((a, b) => a[0].localeCompare(b[0], 'ko-KR'))) {
    console.log(`  ${kind}: ${count}`);
  }
}

await main();
