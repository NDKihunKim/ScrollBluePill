import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { dedupeItems } from '../src/lib/itemDedupe.mjs';

const region = 'GMS';
const version = '83';
const koreanNameRegion = 'KMS';
const koreanNameVersion = '284';
const baseUrl = 'https://maplestory.io';
const outputPath = resolve('public/data/items-gms83-ko.json');
const overridesPath = resolve('data/item-overrides.ko.json');
const visibilityOverridesPath = resolve('data/item-visibility-overrides.json');
const dedupeReportPath = resolve('docs/data-quality/dedupe-resolution-report.md');
const equipmentKindReportPath = resolve('docs/data-quality/equipment-kind-visibility-report.md');
const detailConcurrency = 16;

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

async function fetchJson(url) {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
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

function mapStats(metaInfo = {}) {
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
		['upgradeSlots', definedNumber(metaInfo.tuc)],
	]);
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
	const visibleItems = koreanNamedItems.filter((item) => !equipmentKindHiddenIds.has(item.id));

	return {
		items: visibleItems,
		hiddenIds,
		missingKoreanNameHiddenIds,
		equipmentKindHiddenIds,
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

async function fetchItemDetails(items) {
	let completed = 0;

	return mapWithConcurrency(items, detailConcurrency, async (item) => {
		const detailUrl = new URL(`/api/${region}/${version}/item/${item.id}`, baseUrl);
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

async function main() {
	const overrides = JSON.parse(await readFile(overridesPath, 'utf8'));
	const visibilityOverrides = JSON.parse(await readFile(visibilityOverridesPath, 'utf8'));
	const [items, koreanNameItems] = await Promise.all([
		fetchEquipItems(region, version),
		fetchEquipItems(koreanNameRegion, koreanNameVersion),
	]);
	const itemDetails = await fetchItemDetails(items);
	const validItemDetails = itemDetails.filter((item) => item && Number.isFinite(item.id));
	const detailById = new Map(validItemDetails.map((item) => [item.id, item]));
	const koreanNameById = new Map(koreanNameItems.map((item) => [item.id, item.name]));
	const seenIds = new Set(items.map((item) => String(item.id)));
	const missingOverrideIds = Object.keys(overrides).filter((id) => !seenIds.has(id));
	const visibilityOverrideIds = [
		...(visibilityOverrides.hideItemIds ?? []).map((id) => String(id)),
		...Object.keys(visibilityOverrides.renameById ?? {}),
	];
	const missingVisibilityOverrideIds = visibilityOverrideIds.filter((id) => !seenIds.has(id));

	if (missingOverrideIds.length > 0) {
		throw new Error(`Override item ids are missing from MapleStory.io: ${missingOverrideIds.join(', ')}`);
	}

	if (missingVisibilityOverrideIds.length > 0) {
		throw new Error(`Visibility override item ids are missing from MapleStory.io: ${missingVisibilityOverrideIds.join(', ')}`);
	}

	const rawIndex = items
		.map((item) => {
			const override = overrides[String(item.id)] ?? {};
			const detail = detailById.get(item.id) ?? {};
			const metaInfo = detail.metaInfo ?? {};
			const typeInfo = item.typeInfo ?? {};
			const equipmentKind = override.equipmentKind ?? equipmentKindBySubCategory[typeInfo.subCategory] ?? typeInfo.subCategory;
			const generatedKoreanName = koreanNameById.get(item.id);
			const generatedRequirements = mapRequirements(item, metaInfo);
			const generatedStats = mapStats(metaInfo);

			return {
				id: item.id,
				nameKo: override.nameKo ?? generatedKoreanName ?? item.name,
				nameEn: item.name,
				aliases: override.aliases ?? [],
				equipmentKind,
				requiredLevel: metaInfo.reqLevelEquip ?? item.requiredLevel ?? 0,
				requiredJobs: item.requiredJobs ?? [],
				requirements: { ...generatedRequirements, ...(override.requirements ?? {}) },
				stats: { ...generatedStats, ...(override.stats ?? {}) },
				typeInfo,
			};
		})
		.sort((a, b) => a.id - b.id);
	const visibilityResult = applyVisibilityOverrides(rawIndex, visibilityOverrides);
	const { items: index, resolutions } = dedupeItems(visibilityResult.items);

	const koreanNamedCount = index.filter((item) => /[가-힣]/.test(item.nameKo)).length;
	const aliasCount = index.filter((item) => item.aliases.length > 0).length;
	const statCount = index.filter((item) => Object.keys(item.stats).length > 0).length;
	const missingDetailCount = items.length - validItemDetails.length;
	const overriddenCount = Object.keys(overrides).length;

	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(index, null, 2)}\n`);
	await writeDedupeReport(resolutions, rawIndex.length, visibilityResult.items.length, index.length, visibilityResult);
	await writeEquipmentKindReport(index, visibilityResult);
	console.log(`Generated ${outputPath} with ${index.length}/${rawIndex.length} ${region}/${version} equip items.`);
	console.log(`Korean names filled: ${koreanNamedCount}/${index.length} from ${koreanNameRegion}/${koreanNameVersion} plus overrides.`);
	console.log(`Stats filled: ${statCount}/${index.length} from ${region}/${version} item details.`);
	console.log(`Missing detail records: ${missingDetailCount}.`);
	console.log(`Alias overrides: ${aliasCount}; override records: ${overriddenCount}.`);
	console.log(
		`Visibility overrides: ${visibilityResult.hiddenIds.size} hidden; ${visibilityResult.missingKoreanNameHiddenIds.size} missing Korean names hidden; ${visibilityResult.equipmentKindHiddenIds.size} equipment-kind hidden; ${visibilityResult.renamedIds.size} renamed from ${visibilityOverridesPath}.`,
	);
	console.log(`Dedupe report: ${dedupeReportPath}`);
	console.log(`Equipment kind report: ${equipmentKindReportPath}`);
}

await main();
