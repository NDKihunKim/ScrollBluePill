export const MAPLESTORY_IO_BASE_URL = 'https://maplestory.io';
export const MAPLESTORY_IO_REGION = 'GMS';
export const MAPLESTORY_IO_VERSION = '83';

export const equipmentKindApiFilters = {
	'한손검': {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'One-Handed Weapon',
		subCategoryFilter: 'One-Handed Sword',
	},
	'두손검': {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Two-Handed Sword',
	},
	'한손도끼': {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'One-Handed Weapon',
		subCategoryFilter: 'One-Handed Axe',
	},
	'두손도끼': {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Two-Handed Axe',
	},
	'한손둔기': {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'One-Handed Weapon',
		subCategoryFilter: 'One-Handed Blunt Weapon',
	},
	'두손둔기': {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Two-Handed Blunt',
	},
	창: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Spear',
	},
	폴암: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Pole Arm',
	},
	완드: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'One-Handed Weapon',
		subCategoryFilter: 'Wand',
	},
	스태프: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'One-Handed Weapon',
		subCategoryFilter: 'Staff',
	},
	활: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Bow',
	},
	석궁: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Crossbow',
	},
	아대: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Claw',
	},
	단검: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'One-Handed Weapon',
		subCategoryFilter: 'Dagger',
	},
	너클: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Knuckle',
	},
	총: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Two-Handed Weapon',
		subCategoryFilter: 'Gun',
	},
	방패: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Armor',
		subCategoryFilter: 'Shield',
	},
	모자: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Armor',
		subCategoryFilter: 'Hat',
	},
	얼굴장식: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Accessory',
		subCategoryFilter: 'Face Accessory',
	},
	눈장식: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Accessory',
		subCategoryFilter: 'Eye Decoration',
	},
	귀고리: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Accessory',
		subCategoryFilter: 'Earrings',
	},
	벨트: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Accessory',
		subCategoryFilter: 'Belt',
	},
	상의: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Armor',
		subCategoryFilter: 'Top',
	},
	하의: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Armor',
		subCategoryFilter: 'Bottom',
	},
	한벌옷: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Armor',
		subCategoryFilter: 'Overall',
	},
	장갑: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Armor',
		subCategoryFilter: 'Glove',
	},
	신발: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Armor',
		subCategoryFilter: 'Shoes',
	},
	망토: {
		overallCategoryFilter: 'Equip',
		categoryFilter: 'Armor',
		subCategoryFilter: 'Cape',
	},
};

export function buildItemSearchUrl({
	searchFor = '',
	equipmentKind = '',
	requiredLevel = 0,
	requiredLevelMin,
	requiredLevelMax,
	startPosition = 0,
	count = 20,
	region = MAPLESTORY_IO_REGION,
	version = MAPLESTORY_IO_VERSION,
} = {}) {
	const url = new URL(`/api/${region}/${version}/item`, MAPLESTORY_IO_BASE_URL);
	url.searchParams.set('startPosition', String(startPosition));
	url.searchParams.set('count', String(count));

	const trimmedSearch = String(searchFor).trim();
	if (trimmedSearch) {
		url.searchParams.set('searchFor', trimmedSearch);
	}

	const filters = equipmentKindApiFilters[equipmentKind];
	if (filters) {
		for (const [key, value] of Object.entries(filters)) {
			url.searchParams.set(key, value);
		}
	}

	const parsedMinLevel = Number.parseInt(String(requiredLevelMin ?? requiredLevel), 10);
	const parsedMaxLevel = Number.parseInt(String(requiredLevelMax ?? requiredLevel), 10);
	if (Number.isFinite(parsedMinLevel) && Number.isFinite(parsedMaxLevel) && Math.max(parsedMinLevel, parsedMaxLevel) > 0) {
		url.searchParams.set('minLevelFilter', String(Math.min(parsedMinLevel, parsedMaxLevel)));
		url.searchParams.set('maxLevelFilter', String(Math.max(parsedMinLevel, parsedMaxLevel)));
	}

	return url.toString();
}

const ICON_ID_OVERRIDES = {
	// KMS items not in GMS v83 — redirect to visually similar existing icons
	1002795: 1002794, // Reverse Conrad Henkel → Timeless Conrad Henkel
	1052168: 1052156, // Timeless Mistblue
	1052169: 1052156, // Reverse Mistblue
	1082255: 1082240, // Timeless Hermosa
	1082256: 1082240, // Reverse Hermosa
};

const ICON_VERSION_OVERRIDES = {
	// Items whose icons only exist in a newer API version
	2048717: { version: '253' }, // Eternal Rebirth Flame (post-v83)
};

export function buildItemIconUrl(
	itemId,
	{ region = MAPLESTORY_IO_REGION, version = MAPLESTORY_IO_VERSION } = {},
) {
	const effectiveId = ICON_ID_OVERRIDES[itemId] ?? itemId;
	const versionOverride = ICON_VERSION_OVERRIDES[itemId];
	const resolvedRegion = versionOverride?.region ?? region ?? MAPLESTORY_IO_REGION;
	const resolvedVersion = versionOverride?.version ?? version ?? MAPLESTORY_IO_VERSION;
	return new URL(`/api/${resolvedRegion}/${resolvedVersion}/item/${effectiveId}/icon`, MAPLESTORY_IO_BASE_URL).toString();
}
