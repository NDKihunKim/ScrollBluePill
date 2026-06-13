import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dedupeItems } from '../src/lib/itemDedupe.mjs';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const outputPath = resolve('public/data/items-gms83-ko.json');
const visibilityOverridesPath = resolve('data/item-visibility-overrides.json');
const dedupeReportPath = resolve('docs/data-quality/dedupe-resolution-report.md');
const equipmentKindReportPath = resolve('docs/data-quality/equipment-kind-visibility-report.md');

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('SUPABASE_URL and SUPABASE_ANON_KEY environment variables are required.');
    console.error('Copy .env.example to .env and fill in your Supabase project credentials.');
    process.exit(1);
}

const supabaseRestUrl = new URL('/rest/v1/item_definitions', supabaseUrl);
supabaseRestUrl.searchParams.set('select', '*');

async function fetchSupabase(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            apikey: supabaseAnonKey,
            authorization: `Bearer ${supabaseAnonKey}`,
            ...(options.headers ?? {}),
        },
    });

    if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new Error(`Supabase API error ${response.status}: ${body}`);
    }

    return response.json();
}

function transformSupabaseRow(row) {
    return {
        id: row.id,
        nameKo: row.name_ko,
        nameEn: row.name_en,
        equipmentKind: row.equipment_kind,
        requiredLevel: row.required_level,
        requiredJobs: row.required_jobs ?? [],
        requirements: row.requirements ?? {},
        stats: row.stats ?? {},
        aliases: row.aliases ?? [],
    };
}

function formatStats(stats = {}) {
    const entries = Object.entries(stats).filter(([, value]) => Number.isFinite(value));

    if (entries.length === 0) {
        return '-';
    }

    return entries.map(([key, value]) => `${key}:${value}`).join(', ');
}

function countEquipmentKinds(items) {
    const counts = new Map();

    for (const item of items) {
        counts.set(item.equipmentKind, (counts.get(item.equipmentKind) ?? 0) + 1);
    }

    return [...counts].sort(([a], [b]) => String(a).localeCompare(String(b), 'ko'));
}

function applyVisibilityOverrides(items, visibilityOverrides) {
    const hiddenIds = new Set(visibilityOverrides.hideItemIds ?? []);
    const hiddenEquipmentKinds = new Set(visibilityOverrides.hideEquipmentKinds ?? []);
    const renameById = visibilityOverrides.renameById ?? {};
    const renamedIds = new Set(Object.keys(renameById));
    const manuallyVisibleItems = items
        .filter((item) => !hiddenIds.has(item.id))
        .map((item) => {
            const rename = renameById[String(item.id)];

            if (!rename) {
                return item;
            }

            return {
                ...item,
                nameKo: rename.nameKo ?? item.nameKo,
            };
        });
    const missingKoreanNameHiddenIds = new Set(
        manuallyVisibleItems.filter((item) => !/[가-힣]/.test(item.nameKo)).map((item) => item.id),
    );
    const koreanNamedItems = manuallyVisibleItems.filter((item) => !missingKoreanNameHiddenIds.has(item.id));
    const equipmentKindHiddenIds = new Set(
        koreanNamedItems.filter((item) => hiddenEquipmentKinds.has(item.equipmentKind)).map((item) => item.id),
    );
    const zeroStatHiddenIds = new Set(
        koreanNamedItems
            .filter((item) => Object.keys(item.stats ?? {}).length === 0)
            .map((item) => item.id),
    );
    const visibleItems = koreanNamedItems.filter(
        (item) => !equipmentKindHiddenIds.has(item.id) && !zeroStatHiddenIds.has(item.id),
    );

    return {
        items: visibleItems,
        hiddenIds,
        missingKoreanNameHiddenIds,
        equipmentKindHiddenIds,
        zeroStatHiddenIds,
        hiddenEquipmentKinds,
        renamedIds,
    };
}

async function writeDedupeReport(resolutions, sourceCount, dedupeInputCount, afterCount, visibilitySummary) {
    const exact = resolutions.filter((resolution) => resolution.action === 'collapse-exact');
    const variant = resolutions.filter((resolution) => resolution.action === 'collapse-variant-highest-level');
    const unresolved = resolutions.filter((resolution) => resolution.action === 'unresolved-variant');
    const dedupeHiddenCount = exact.reduce((sum, resolution) => sum + resolution.hidden.length, 0) +
        variant.reduce((sum, resolution) => sum + resolution.hidden.length, 0);
    const visibilityHiddenIds = [...visibilitySummary.hiddenIds].sort((a, b) => a - b);
    const missingKoreanNameHiddenIds = [...visibilitySummary.missingKoreanNameHiddenIds].sort((a, b) => a - b);
    const equipmentKindHiddenIds = [...visibilitySummary.equipmentKindHiddenIds].sort((a, b) => a - b);
    const zeroStatHiddenIds = [...visibilitySummary.zeroStatHiddenIds].sort((a, b) => a - b);
    const hiddenEquipmentKinds = [...visibilitySummary.hiddenEquipmentKinds].sort();
    const visibilityRenamedIds = [...visibilitySummary.renamedIds].sort((a, b) => Number(a) - Number(b));
    const lines = [
        '# Dedupe Resolution Report',
        '',
        'Generated by `scripts/generate-item-index.mjs`.',
        '',
        `Raw item count: ${sourceCount}`,
        `Visibility-hidden item count: ${visibilityHiddenIds.length}`,
        `Missing-Korean-name hidden item count: ${missingKoreanNameHiddenIds.length}`,
        `Equipment-kind hidden item count: ${equipmentKindHiddenIds.length}`,
        `Zero-stat hidden item count: ${zeroStatHiddenIds.length}`,
        `Visibility-renamed item count: ${visibilityRenamedIds.length}`,
        `Dedupe input item count: ${dedupeInputCount}`,
        `Deduped item count: ${afterCount}`,
        `Dedupe-hidden item count: ${dedupeHiddenCount}`,
        `Exact-signature groups collapsed: ${exact.length}`,
        `Variant highest-level groups collapsed: ${variant.length}`,
        `Unresolved variant groups: ${unresolved.length}`,
        '',
        'Policy:',
        '- Exact-signature groups keep the lowest item id.',
        '- Variant-signature groups keep one item only when exactly one item has the highest required level.',
        '- Variant-signature groups with a highest-level tie are left untouched and listed as unresolved.',
        '',
        'Visibility overrides:',
        `- Hidden item ids: ${visibilityHiddenIds.join(', ') || '-'}`,
        `- Missing-Korean-name hidden item ids: ${missingKoreanNameHiddenIds.join(', ') || '-'}`,
        `- Hidden equipment kinds: ${hiddenEquipmentKinds.join(', ') || '-'}`,
        `- Equipment-kind hidden item ids: ${equipmentKindHiddenIds.join(', ') || '-'}`,
        `- Zero-stat hidden item ids: ${zeroStatHiddenIds.join(', ') || '-'}`,
        `- Renamed item ids: ${visibilityRenamedIds.join(', ') || '-'}`,
        '',
    ];

    function appendResolution(title, resolutionGroups) {
        lines.push(`## ${title}`, '');

        if (resolutionGroups.length === 0) {
            lines.push('None.', '');
            return;
        }

        for (const resolution of resolutionGroups) {
            const first = resolution.group[0];
            lines.push(
                `### ${first.nameKo} / ${first.nameEn} / ${first.equipmentKind}`,
                '',
                `Reason: ${resolution.reason}`,
                `Kept: ${resolution.kept ? `${resolution.kept.id} Lv.${resolution.kept.requiredLevel}` : 'unresolved'}`,
                `Hidden: ${resolution.hidden.map((item) => item.id).join(', ') || '-'}`,
                '',
                '| ID | Level | Jobs | Requirements | Stats |',
                '| --- | ---: | --- | --- | --- |',
            );

            for (const item of [...resolution.group].sort((a, b) => a.requiredLevel - b.requiredLevel || a.id - b.id)) {
                lines.push(
                    `| ${item.id} | ${item.requiredLevel} | ${(item.requiredJobs ?? []).join(', ') || '-'} | ${formatStats(
                        item.requirements,
                    )} | ${formatStats(item.stats)} |`,
                );
            }

            lines.push('');
        }
    }

    appendResolution('Collapsed Exact-Signature Groups', exact);
    appendResolution('Collapsed Variant Highest-Level Groups', variant);
    appendResolution('Unresolved Variant Groups', unresolved);

    await mkdir(dirname(dedupeReportPath), { recursive: true });
    await writeFile(dedupeReportPath, `${lines.join('\n')}\n`);
}

async function writeEquipmentKindReport(items, visibilitySummary) {
    const hiddenEquipmentKinds = [...visibilitySummary.hiddenEquipmentKinds].sort();
    const lines = [
        '# Equipment Kind Visibility Report',
        '',
        'Generated by `scripts/generate-item-index.mjs`.',
        '',
        'Use this report to review which `equipmentKind` values are still searchable.',
        '',
        `Hidden equipment kinds: ${hiddenEquipmentKinds.join(', ') || '-'}`,
        '',
        '## Search-Visible Equipment Kinds',
        '',
        '| equipmentKind | Item count |',
        '| --- | ---: |',
        ...countEquipmentKinds(items).map(([kind, count]) => `| ${kind} | ${count} |`),
        '',
    ];

    await mkdir(dirname(equipmentKindReportPath), { recursive: true });
    await writeFile(equipmentKindReportPath, `${lines.join('\n')}\n`);
}

async function main() {
    const visibilityOverrides = JSON.parse(await readFile(visibilityOverridesPath, 'utf8'));

    console.log('Fetching item definitions from Supabase...');

    // Paginate through all published items (Supabase defaults to 1000 rows/page)
    const allRows = [];
    let offset = 0;
    const pageSize = 1000;
    while (true) {
        const pageUrl = new URL(supabaseRestUrl);
        pageUrl.searchParams.set('limit', String(pageSize));
        pageUrl.searchParams.set('offset', String(offset));
        const page = await fetchSupabase(pageUrl);
        allRows.push(...page);
        console.log(`Fetched page with ${page.length} items (total so far: ${allRows.length})`);
        if (page.length < pageSize) break;
        offset += pageSize;
    }

    console.log(`Fetched ${allRows.length} item definitions (RLS-filtered to published only).`);

    // Transform snake_case DB rows to camelCase frontend shape
    const rawIndex = allRows
        .map(transformSupabaseRow)
        .sort((a, b) => a.id - b.id);

    // Validate rename override IDs exist in the data (hidden items are now excluded by Supabase RLS)
    const seenIds = new Set(rawIndex.map((item) => String(item.id)));
    const renameOverrideIds = Object.keys(visibilityOverrides.renameById ?? {});
    const missingRenameIds = renameOverrideIds.filter((id) => !seenIds.has(id));
    if (missingRenameIds.length > 0) {
        throw new Error(`Rename override item ids are missing from Supabase data: ${missingRenameIds.join(', ')}`);
    }

    // Apply visibility overrides (unchanged logic)
    const visibilityResult = applyVisibilityOverrides(rawIndex, visibilityOverrides);
    const { items: index, resolutions } = dedupeItems(visibilityResult.items);

    const koreanNamedCount = index.filter((item) => /[가-힣]/.test(item.nameKo)).length;
    const aliasCount = index.filter((item) => (item.aliases ?? []).length > 0).length;
    const statCount = index.filter((item) => Object.keys(item.stats ?? {}).length > 0).length;

    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`);
    await writeDedupeReport(resolutions, rawIndex.length, visibilityResult.items.length, index.length, visibilityResult);
    await writeEquipmentKindReport(index, visibilityResult);

    console.log(`Generated ${outputPath} with ${index.length}/${rawIndex.length} items.`);
    console.log(`Korean names filled: ${koreanNamedCount}/${index.length}.`);
    console.log(`Stats filled: ${statCount}/${index.length}.`);
    console.log(`Alias count: ${aliasCount}.`);
    console.log(
        `Visibility overrides: ${visibilityResult.hiddenIds.size} hidden by ID; ` +
        `${visibilityResult.missingKoreanNameHiddenIds.size} missing Korean names hidden; ` +
        `${visibilityResult.equipmentKindHiddenIds.size} equipment-kind hidden; ` +
        `${visibilityResult.zeroStatHiddenIds.size} zero-stat hidden; ` +
        `${visibilityResult.renamedIds.size} renamed from ${visibilityOverridesPath}.`,
    );
    console.log(`Dedupe report: ${dedupeReportPath}`);
    console.log(`Equipment kind report: ${equipmentKindReportPath}`);
}

await main();
