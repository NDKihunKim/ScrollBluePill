import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const region = 'GMS';
const version = '83';
const koreanNameRegion = 'KMS';
const koreanNameVersion = '284';
const baseUrl = 'https://maplestory.io';
const overridesPath = resolve('data/item-overrides.ko.json');
const detailConcurrency = 16;
const upsertBatchSize = 500;

const equipmentKindBySubCategory = {
    'One-Handed Sword': '한손검',
    'Two-Handed Sword': '두손검',
    'One-Handed Axe': '한손도끼',
    'Two-Handed Axe': '두손도끼',
    'One-Handed Blunt Weapon': '한손둔기',
    'Two-Handed Blunt': '두손둔기',
    Spear: '창',
    'Pole Arm': '폴암',
    Wand: '완드',
    Staff: '스태프',
    Bow: '활',
    Crossbow: '석궁',
    Claw: '아대',
    Dagger: '단검',
    Knuckle: '너클',
    Gun: '총',
    Shield: '방패',
    Hat: '모자',
    'Face Accessory': '얼굴장식',
    'Eye Decoration': '눈장식',
    Ring: '반지',
    Pendant: '펜던트',
    Belt: '벨트',
    Earrings: '귀고리',
    Earring: '귀고리',
    Top: '상의',
    Bottom: '하의',
    Overall: '한벌옷',
    Glove: '장갑',
    Shoes: '신발',
    Cape: '망토',
};

const weaponAttackSpeedBySubCategory = {
    'One-Handed Sword': 5,
    'Two-Handed Sword': 6,
    'One-Handed Axe': 5,
    'Two-Handed Axe': 6,
    'One-Handed Blunt Weapon': 5,
    'Two-Handed Blunt': 6,
    Spear: 7,
    'Pole Arm': 8,
    Wand: 6,
    Staff: 8,
    Bow: 6,
    Crossbow: 6,
    Claw: 4,
    Dagger: 4,
    Knuckle: 5,
    Gun: 5,
};

if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables are required.');
    console.error('Copy .env.example to .env and fill in your Supabase project credentials.');
    process.exit(1);
}

async function fetchJson(url) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.json();
}

async function fetchSupabase(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            apikey: supabaseServiceRoleKey,
            authorization: `Bearer ${supabaseServiceRoleKey}`,
            'content-type': 'application/json',
            ...(options.headers ?? {}),
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Supabase API error ${response.status} on ${url}: ${body}`);
    }

    return response.json();
}

async function fetchEquipItems(itemRegion, itemVersion) {
    const countUrl = new URL(`/api/${itemRegion}/${itemVersion}/item/count`, baseUrl);
    countUrl.searchParams.set('overallCategoryFilter', 'Equip');
    const total = await fetchJson(countUrl);

    const listUrl = new URL(`/api/${itemRegion}/${itemVersion}/item/list`, baseUrl);
    listUrl.searchParams.set('startPosition', '0');
    listUrl.searchParams.set('count', String(total));
    listUrl.searchParams.set('overallCategoryFilter', 'Equip');

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

async function fetchItemDetails(items, itemRegion, itemVersion) {
    let completed = 0;

    return mapWithConcurrency(items, detailConcurrency, async (item) => {
        const detailUrl = new URL(`/api/${itemRegion}/${itemVersion}/item/${item.id}`, baseUrl);
        let detail = null;
        try {
            detail = await fetchJson(detailUrl);
        } catch (error) {
            console.warn(`Unable to fetch item detail for ${item.id}: ${error.message}`);
        }
        completed += 1;

        if (completed % 500 === 0 || completed === items.length) {
            console.log(`Fetched item details: ${completed}/${items.length}`);
        }

        return detail;
    });
}

function definedNumber(value) {
    return Number.isFinite(value) ? value : undefined;
}

function compactNumbers(entries) {
    return Object.fromEntries(entries.filter(([, value]) => Number.isFinite(value)));
}

function mapRequirements(item, metaInfo = {}) {
    return compactNumbers([
        ['str', definedNumber(metaInfo.reqSTR)],
        ['dex', definedNumber(metaInfo.reqDEX)],
        ['int', definedNumber(metaInfo.reqINT)],
        ['luk', definedNumber(metaInfo.reqLUK)],
        ['pop', definedNumber(metaInfo.reqPOP)],
    ]);
}

function mapStats(metaInfo = {}, subCategory) {
    return compactNumbers([
        ['str', definedNumber(metaInfo.incSTR)],
        ['dex', definedNumber(metaInfo.incDEX)],
        ['int', definedNumber(metaInfo.incINT)],
        ['luk', definedNumber(metaInfo.incLUK)],
        ['maxHp', definedNumber(metaInfo.incMHP)],
        ['maxMp', definedNumber(metaInfo.incMMP)],
        ['weaponAttack', definedNumber(metaInfo.incPAD)],
        ['magicAttack', definedNumber(metaInfo.incMAD)],
        ['weaponDefense', definedNumber(metaInfo.incPDD)],
        ['magicDefense', definedNumber(metaInfo.incMDD)],
        ['accuracy', definedNumber(metaInfo.incACC)],
        ['avoidability', definedNumber(metaInfo.incEVA)],
        ['speed', definedNumber(metaInfo.incSpeed)],
        ['jump', definedNumber(metaInfo.incJump)],
        ['attackSpeed', resolveAttackSpeed(metaInfo, subCategory)],
        ['upgradeSlots', definedNumber(metaInfo.tuc)],
    ]);
}

function resolveAttackSpeed(metaInfo, subCategory) {
    if (Number.isFinite(metaInfo.attackSpeed)) {
        return metaInfo.attackSpeed;
    }
    return weaponAttackSpeedBySubCategory[subCategory] ?? null;
}

async function resolveVersionTagId() {
    const url = new URL('/rest/v1/version_tags', supabaseUrl);
    url.searchParams.set('is_active', 'eq.true');
    url.searchParams.set('limit', '1');
    url.searchParams.set('select', 'id');
    const tags = await fetchSupabase(url);

    if (tags.length > 0) {
        return tags[0].id;
    }

    console.log('No active version tag found. Creating default version tag...');
    const createUrl = new URL('/rest/v1/version_tags', supabaseUrl);
    const [created] = await fetchSupabase(createUrl, {
        method: 'POST',
        body: JSON.stringify({
            label_ko: 'GMS v83 (기본)',
            label_en: 'GMS v83 (default)',
            description: 'Auto-created by seed-item-definitions.mjs',
            is_active: true,
        }),
    });

    if (!created || !created.id) {
        throw new Error('Failed to create default version tag.');
    }

    console.log(`Created version tag: ${created.id}`);
    return created.id;
}

async function upsertItemDefinitions(rows) {
    console.log(`Upserting ${rows.length} item definitions in batches of ${upsertBatchSize}...`);

    for (let i = 0; i < rows.length; i += upsertBatchSize) {
        const batch = rows.slice(i, i + upsertBatchSize);
        const url = new URL('/rest/v1/item_definitions', supabaseUrl);

        await fetchSupabase(url, {
            method: 'POST',
            headers: {
                prefer: 'resolution=merge-duplicates',
            },
            body: JSON.stringify(batch),
        });

        const done = Math.min(i + upsertBatchSize, rows.length);
        console.log(`Upserted ${done}/${rows.length} items`);
    }
}

async function main() {
    const overrides = JSON.parse(await readFile(overridesPath, 'utf8'));

    // 1. Fetch items from maplestory.io
    console.log('Fetching equip items from maplestory.io...');
    const [items, koreanNameItems] = await Promise.all([
        fetchEquipItems(region, version),
        fetchEquipItems(koreanNameRegion, koreanNameVersion),
    ]);
    console.log(`Fetched ${items.length} items from ${region}/${version}`);
    console.log(`Fetched ${koreanNameItems.length} Korean names from ${koreanNameRegion}/${koreanNameVersion}`);

    // 2. Fetch item details (stats/requirements)
    const itemDetails = await fetchItemDetails(items, region, version);
    const validItemDetails = itemDetails.filter((item) => item && Number.isFinite(item.id));
    const detailById = new Map(validItemDetails.map((item) => [item.id, item]));
    const koreanNameById = new Map(koreanNameItems.map((item) => [item.id, item.name]));

    // 3. Validate override IDs
    const seenIds = new Set(items.map((item) => String(item.id)));
    const missingOverrideIds = Object.keys(overrides).filter((id) => !seenIds.has(id));
    if (missingOverrideIds.length > 0) {
        throw new Error(`Override item ids are missing from MapleStory.io: ${missingOverrideIds.join(', ')}`);
    }

    // 4. Build rows — merge API data with overrides
    const rows = items.map((item) => {
        const override = overrides[String(item.id)] ?? {};
        const detail = detailById.get(item.id) ?? {};
        const metaInfo = detail.metaInfo ?? {};
        const typeInfo = item.typeInfo ?? {};
        const subCategory = typeInfo.subCategory;
        const equipmentKind = override.equipmentKind ?? equipmentKindBySubCategory[subCategory] ?? subCategory;
        const generatedKoreanName = koreanNameById.get(item.id);
        const generatedRequirements = mapRequirements(item, metaInfo);
        const generatedStats = mapStats(metaInfo, subCategory);

        return {
            id: item.id,
            version_tag_id: null, // filled below
            name_ko: override.nameKo ?? generatedKoreanName ?? item.name,
            name_en: item.name ?? null,
            equipment_kind: equipmentKind,
            required_level: metaInfo.reqLevelEquip ?? item.requiredLevel ?? 0,
            required_jobs: item.requiredJobs ?? [],
            requirements: { ...generatedRequirements, ...(override.requirements ?? {}) },
            stats: { ...generatedStats, ...(override.stats ?? {}) },
            aliases: override.aliases ?? [],
            published_status: 'published',
            source_note: `Seeded from maplestory.io ${region}/${version}`,
        };
    });

    // 5. Resolve version tag
    const versionTagId = await resolveVersionTagId();
    for (const row of rows) {
        row.version_tag_id = versionTagId;
    }

    // 6. Upsert into Supabase
    console.log(`Upserting ${rows.length} item definitions to Supabase...`);
    await upsertItemDefinitions(rows);

    // 7. Summary
    const koreanNamedCount = rows.filter((row) => /[가-힣]/.test(row.name_ko)).length;
    const aliasCount = rows.filter((row) => (row.aliases ?? []).length > 0).length;
    const statCount = rows.filter((row) => Object.keys(row.stats ?? {}).length > 0).length;
    const missingDetailCount = items.length - validItemDetails.length;

    console.log(`Seeded ${rows.length} item definitions.`);
    console.log(`Korean names filled: ${koreanNamedCount}/${rows.length}`);
    console.log(`Stats filled: ${statCount}/${rows.length}`);
    console.log(`Missing detail records: ${missingDetailCount}`);
    console.log(`Alias overrides: ${aliasCount}; override records: ${Object.keys(overrides).length}`);
    console.log(`Version tag: ${versionTagId}`);
}

await main();
