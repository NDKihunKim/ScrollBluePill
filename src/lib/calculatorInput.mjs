export const weaponKinds = [
	'한손검',
	'두손검',
	'한손도끼',
	'두손도끼',
	'한손둔기',
	'두손둔기',
	'창',
	'폴암',
	'완드',
	'스태프',
	'활',
	'석궁',
	'아대',
	'단검',
	'너클',
	'총',
	'방패',
];

export const armorKinds = [
	'모자',
	'얼굴장식',
	'눈장식',
	'귀고리',
	'상의',
	'하의',
	'한벌옷',
	'장갑',
	'신발',
	'망토',
];

export const jobKinds = ['초보자', '전사', '마법사', '궁수', '도적', '해적'];

export function normalizeItemLevel(value) {
	const parsed = Number.parseInt(String(value), 10);

	if (!Number.isFinite(parsed)) {
		return 0;
	}

	return Math.max(0, parsed);
}

export function nextItemLevel(value, delta) {
	return normalizeItemLevel(normalizeItemLevel(value) + delta);
}
