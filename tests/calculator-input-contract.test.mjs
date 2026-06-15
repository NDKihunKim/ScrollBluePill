import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');
const generatedItemIndex = JSON.parse(
	await readFile(new URL('../public/data/items-gms83-ko.json', import.meta.url), 'utf8'),
);
const dedupeReport = await readFile(new URL('../docs/data-quality/dedupe-resolution-report.md', import.meta.url), 'utf8');
const equipmentKindReport = await readFile(
	new URL('../docs/data-quality/equipment-kind-visibility-report.md', import.meta.url),
	'utf8',
);
const duplicateGroupsReport = await readFile(
	new URL('../docs/data-quality/duplicate-item-groups.md', import.meta.url),
	'utf8',
);

test('calculator input helper clamps item level at zero', async () => {
	const { nextItemLevel } = await import('../src/lib/calculatorInput.mjs');

	assert.equal(nextItemLevel(0, -5), 0);
	assert.equal(nextItemLevel(3, -5), 0);
	assert.equal(nextItemLevel(10, -5), 5);
	assert.equal(nextItemLevel(10, 5), 15);
	assert.equal(nextItemLevel('abc', 5), 5);
});

test('maker stimulant slot source contract is present', async () => {
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');

	assert.match(indexSource, /maker-gem-slot--stimulant/);
	assert.match(indexSource, /content:\s*'\(촉진제\)'/);
	assert.match(makerPanelSource, /STIMULANT_ITEM_ID\s*=\s*4130000/);
	assert.match(makerPanelSource, /buildItemIconUrl\(STIMULANT_ITEM_ID\)/);
	assert.match(makerPanelSource, /nameSpan\.textContent\s*=\s*'촉진제'/);
	assert.match(makerPanelSource, /applyStimulant/);
	assert.match(makerPanelSource, /clearStimulant/);
});

test('maker-only changes notify expected-value button state', async () => {
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.match(makerPanelSource, /onStateChange/);
	assert.match(makerPanelSource, /renderEnhancedItemCard\(selectedBaseItem,\s*accumulatedStats,\s*remaining,\s*appliedCount,\s*gradeColor,\s*statBreakdown\);\s*onStateChange\?\.\(\);/);
	assert.match(enhancementPanelSource, /onStateChange:\s*\(\)\s*=>\s*notifyEv\(\)/);
});

test('maker stimulant and gem slots share active slot selection state', async () => {
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');

	assert.match(makerPanelSource, /let activeStimulantSlot\s*=\s*false/);
	assert.match(makerPanelSource, /if \(activeStimulantSlot\) \{\s*box\.classList\.add\('maker-gem-slot--active'\);/);
	assert.match(makerPanelSource, /activeStimulantSlot\s*=\s*true;\s*editingSlotIndex\s*=\s*-1;\s*renderGemSlots\(\);\s*renderStimulantInputPanel\(\);/);
	assert.match(makerPanelSource, /if \(!isDisabled && editingSlotIndex === i\) \{\s*box\.classList\.add\('maker-gem-slot--active'\);/);
	assert.match(indexSource, /:global\(\.maker-gem-slot--active\)\s*\{[^}]*border-style:\s*solid;/);
	assert.match(indexSource, /:global\(\.item-level-up-slot--active\)\s*\{[^}]*border-style:\s*solid;/);
});

test('closing maker panel preserves applied maker stats when another feature opens', async () => {
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');
	const closeStart = makerPanelSource.indexOf('closeMakerPanel()');
	const closeEnd = makerPanelSource.indexOf('\n    },\n  };', closeStart);
	const closeMethodSource = makerPanelSource.slice(closeStart, closeEnd);

	assert.match(closeMethodSource, /enhancementState\.makerActive\s*=\s*false/);
	assert.doesNotMatch(closeMethodSource, /deactivateMaker\(enhancementState\)/);
});

test('maker button smoothly scrolls to expanded maker controls', async () => {
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');

	assert.match(
		makerPanelSource,
		/makerSection\.scrollIntoView\(\{\s*behavior:\s*'smooth',\s*block:\s*'start'\s*\}\s*\);/,
	);
});

test('stat input rows expose per-row max delta buttons', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');

	assert.match(enhancementPanelSource, /minMaxBtn\.textContent\s*=\s*'MIN'/);
	assert.match(enhancementPanelSource, /chaosStepperValues\.set\(key,\s*-limit\)/);
	assert.match(enhancementPanelSource, /maxBtn\.textContent\s*=\s*'MAX'/);
	assert.match(enhancementPanelSource, /chaosStepperValues\.set\(key,\s*limit\)/);
	assert.match(enhancementPanelSource, /row\.append\(label,\s*minMaxBtn,\s*minusBtn,\s*valueDisplay,\s*plusBtn,\s*maxBtn\)/);

	assert.match(makerPanelSource, /minMaxBtn\.textContent\s*=\s*'MIN'/);
	assert.match(makerPanelSource, /stimulantValues\.set\(key,\s*-limit\)/);
	assert.match(makerPanelSource, /maxBtn\.textContent\s*=\s*'MAX'/);
	assert.match(makerPanelSource, /stimulantValues\.set\(key,\s*limit\)/);
	assert.match(makerPanelSource, /row\.append\(label,\s*minMaxBtn,\s*minusBtn,\s*valueDisplay,\s*plusBtn,\s*maxBtn\)/);

	assert.match(indexSource, /chaos-stepper-btn--max/);
});

test('chaos apply button is horizontally centered in its input panel', () => {
	assert.match(
		indexSource,
		/:global\(\.chaos-apply-button\)\s*\{[^}]*align-self:\s*center;/,
	);
});

test('calculator first step renders MapleStory input candidates', async () => {
	const { armorKinds, jobKinds, weaponKinds } = await import('../src/lib/calculatorInput.mjs');
	const { equipmentKindApiFilters } = await import('../src/lib/maplestoryIo.mjs');

	for (const label of ['한손검', '두손검', '스태프', '활', '아대', '방패']) {
		assert.ok(weaponKinds.includes(label), `missing weapon kind: ${label}`);
	}

	for (const label of ['모자', '상의', '하의', '한벌옷', '장갑', '신발', '망토', '벨트']) {
		assert.ok(armorKinds.includes(label), `missing armor kind: ${label}`);
	}

	for (const label of ['전사', '마법사', '궁수', '도적', '해적']) {
		assert.ok(jobKinds.includes(label), `missing job kind: ${label}`);
	}

	assert.match(indexSource, /<h2>1\. 아이템 검색<\/h2>/);
	assert.match(indexSource, /name="itemName"/);
	assert.match(indexSource, /type="search"/);
	assert.match(indexSource, /data-item-name-input/);
	assert.match(indexSource, /data-selected-item-id/);
	assert.match(indexSource, /data-item-suggestions/);
	assert.match(indexSource, /data-manual-search-toggle/);
	assert.match(indexSource, />\s*필터 검색\s*<\/button>/);
	assert.match(indexSource, /aria-controls="manual-search-fields"/);
	assert.match(indexSource, /aria-expanded="false"/);
	assert.match(indexSource, /id="manual-search-fields"/);
	assert.match(indexSource, /data-manual-search-fields/);
	assert.match(indexSource, /aria-hidden="true"/);
	assert.match(indexSource, /inert/);
	assert.doesNotMatch(indexSource, /item\.nameEn/);
	assert.match(indexSource, /meta\.textContent = item\.equipmentKind/);
	assert.doesNotMatch(indexSource, /meta\.textContent = `\$\{item\.equipmentKind\} · Lv\.\$\{item\.requiredLevel\}`;/);
	assert.match(indexSource, /aria-autocomplete="list"/);
	assert.match(indexSource, /data-selected-item-card/);
	assert.match(indexSource, /data-selected-item-icon/);
	assert.match(indexSource, /data-selected-item-requirements/);
	assert.match(indexSource, /data-selected-item-stats/);
	assert.ok(indexSource.indexOf('data-selected-item-card') > indexSource.indexOf('<h2>결과</h2>'));
	assert.ok(indexSource.indexOf('아이템 이름') < indexSource.indexOf('직업'));
	assert.ok(indexSource.indexOf('data-item-name-search') < indexSource.indexOf('data-manual-search-toggle'));
	assert.ok(indexSource.indexOf('data-manual-search-toggle') < indexSource.indexOf('id="manual-search-fields"'));
	assert.ok(indexSource.indexOf('직업') < indexSource.indexOf('장비 종류'));
	assert.ok(indexSource.indexOf('장비 종류') < indexSource.indexOf('아이템 요구 레벨'));
	assert.match(indexSource, /class="item-search-fields"/);
	assert.match(indexSource, /class="input-row field-block item-name-search"/);
	assert.match(indexSource, /class="input-row job-options"/);
	assert.match(indexSource, /class="input-row field-block equipment-block"/);
	assert.match(indexSource, /class="input-row\b/);
	assert.match(indexSource, /\.input-row \{/);
	assert.match(indexSource, /border: 1px solid var\(--line\);/);
	assert.match(indexSource, /border-radius: 8px;/);
	assert.match(indexSource, /\.manual-search-accordion \{/);
	assert.match(indexSource, /grid-template-rows: 0fr;/);
	assert.match(indexSource, /\.manual-search-accordion\.open \{/);
	assert.match(indexSource, /grid-template-rows: 1fr;/);
	assert.match(indexSource, /grid-template-rows 220ms ease/);
	assert.match(indexSource, /manualSearchFields\.inert = !isOpen/);
	assert.match(indexSource, /manualSearchToggle\.setAttribute\('aria-expanded', String\(isOpen\)\)/);
	assert.match(indexSource, /\.item-suggestion-menu :global\(\.item-suggestion-option\)/);
	assert.match(indexSource, /\.item-suggestion-menu :global\(\.item-suggestion-text span\)/);
	assert.match(indexSource, /gap: 12px;/);
	assert.match(indexSource, /border-top: 1px solid var\(--line\);/);
	assert.doesNotMatch(indexSource, /\.input-row \+ \.input-row/);
	assert.match(indexSource, /jobKinds\.map/);
	assert.match(indexSource, /data-job-select-all/);
	assert.match(indexSource, /data-job-clear-all/);
	assert.match(indexSource, /name="jobs" value=\{job\} checked hidden/);
	assert.match(indexSource, /data-equipment-mode="weapon"/);
	assert.match(indexSource, /data-equipment-mode="armor"/);
	assert.match(indexSource, /type="hidden"\s+name="equipmentKind"/);
	assert.match(indexSource, /class="dropdown-frame"/);
	assert.match(indexSource, /data-equipment-dropdown/);
	assert.match(indexSource, /data-equipment-trigger/);
	assert.match(indexSource, /data-equipment-menu/);
	assert.match(indexSource, /data-equipment-option=\{kind\}/);
	assert.match(indexSource, /data-equipment-options="armor" hidden/);
	assert.match(indexSource, /\.equipment-menu \[data-equipment-options\]\[hidden\] \{/);
	assert.match(indexSource, /display: none;/);
	assert.doesNotMatch(indexSource, /<select id="equipment-kind"/);
	assert.match(indexSource, /weaponKinds\.map/);
	assert.match(indexSource, /armorKinds\.map/);
	assert.match(indexSource, /data-level-step="-5"/);
	assert.match(indexSource, /data-level-step="5"/);
	assert.match(indexSource, /min="0"/);
	assert.match(indexSource, /fetch\('\/data\/items-gms83-ko\.json'\)/);
	assert.match(indexSource, /'공격력', 'weaponAttack'/);
	assert.match(indexSource, /'공격속도', 'attackSpeed'/);
	assert.match(indexSource, /'최대HP', 'maxHp'/);
	assert.match(indexSource, /Beginner: '초보자'/);
	assert.match(indexSource, /Pirate: '해적'/);
	assert.match(indexSource, /formatRequiredJobs/);
	assert.match(indexSource, /jobKindByRequiredJob/);
	assert.match(indexSource, /5: '빠름'/);
	assert.match(indexSource, /speedLabelByValue\[value\] \?\? '속도 정보 없음'/);
	assert.match(indexSource, /syncFiltersToSelectedItem\(item\)/);
	assert.match(indexSource, /jobKindByRequiredJob/);
	assert.match(indexSource, /setEquipmentOption\(matchingOption\)/);
	assert.match(indexSource, /requiredLevel = String\(normalizeItemLevel\(item\.requiredLevel\)\)/);

	for (const kind of [...weaponKinds, ...armorKinds]) {
		assert.ok(equipmentKindApiFilters[kind], `missing MapleStory.io mapping for: ${kind}`);
	}
});

test('MapleStory.io search helper builds item query URLs', async () => {
	const { MAPLESTORY_IO_REGION, MAPLESTORY_IO_VERSION, buildItemIconUrl, buildItemSearchUrl } =
		await import('../src/lib/maplestoryIo.mjs');

	assert.equal(MAPLESTORY_IO_REGION, 'GMS');
	assert.equal(MAPLESTORY_IO_VERSION, '83');

	const url = new URL(
		buildItemSearchUrl({
			searchFor: 'Zakum Helmet',
			equipmentKind: '모자',
			requiredLevel: 50,
		}),
	);

	assert.equal(url.pathname, '/api/GMS/83/item');
	assert.equal(url.searchParams.get('searchFor'), 'Zakum Helmet');
	assert.equal(url.searchParams.get('overallCategoryFilter'), 'Equip');
	assert.equal(url.searchParams.get('categoryFilter'), 'Armor');
	assert.equal(url.searchParams.get('subCategoryFilter'), 'Hat');
	assert.equal(url.searchParams.get('minLevelFilter'), '50');
	assert.equal(url.searchParams.get('maxLevelFilter'), '50');
	assert.equal(url.searchParams.get('count'), '20');

	assert.equal(buildItemIconUrl(1002357), 'https://maplestory.io/api/GMS/83/item/1002357/icon');
});

test('Korean item search supports two-character names and aliases', async () => {
	const { buildSpacedNameInitials, normalizeSearchText, searchKoreanItems } = await import('../src/lib/itemSearch.mjs');

	assert.equal(normalizeSearchText(' 노 가 '), '노가');
	assert.equal(buildSpacedNameInitials('드래곤 샤인보우'), '드샤');

	assert.equal(generatedItemIndex.length, 2098);
	assert.equal(generatedItemIndex.filter((item) => !/[가-힣]/.test(item.nameKo)).length, 0);
	assert.equal(generatedItemIndex.filter((item) => item.equipmentKind === 'Medal').length, 0);
	assert.equal(generatedItemIndex.filter((item) => item.equipmentKind === 'Cash').length, 0);
	for (const hiddenKind of ['Hair', 'hair', 'Face', 'Mount', 'Pet Equipment', 'Skill Effect']) {
		assert.equal(generatedItemIndex.filter((item) => item.equipmentKind === hiddenKind).length, 0);
	}
	assert.equal(generatedItemIndex.filter((item) => item.equipmentKind === 'Ring').length, 0);
	assert.equal(generatedItemIndex.filter((item) => item.equipmentKind === 'Pendant').length, 0);
	assert.ok(generatedItemIndex.some((item) => item.equipmentKind === '반지'));
	assert.ok(generatedItemIndex.some((item) => item.equipmentKind === '펜던트'));
	assert.equal(generatedItemIndex.filter((item) => item.equipmentKind === 'Belt').length, 0);
	assert.equal(generatedItemIndex.filter((item) => item.equipmentKind === '벨트').length, 14);
	assert.equal(generatedItemIndex.some((item) => item.id === 1002390 || item.id === 1002430), false);
	assert.ok(generatedItemIndex.filter((item) => Object.keys(item.stats).length > 0).length > 2000);
	assert.equal(searchKoreanItems('노', { items: generatedItemIndex }).length, 0);

	const icarusCapeById = new Map(
		generatedItemIndex.filter((item) => [1102054, 1102055, 1102056].includes(item.id)).map((item) => [item.id, item]),
	);
	assert.equal(icarusCapeById.get(1102054)?.nameKo, '이카루스의 망토 (회피)');
	assert.equal(icarusCapeById.get(1102054)?.stats.avoidability, 15);
	assert.equal(icarusCapeById.get(1102055)?.nameKo, '이카루스의 망토 (이속)');
	assert.equal(icarusCapeById.get(1102055)?.stats.speed, 10);
	assert.equal(icarusCapeById.get(1102056)?.nameKo, '이카루스의 망토 (점프)');
	assert.equal(icarusCapeById.get(1102056)?.stats.jump, 5);

	const seraphims = searchKoreanItems('세라핌즈', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		seraphims.map((item) => item.id),
		[1482008],
	);
	assert.equal(seraphims[0]?.requiredLevel, 60);
	assert.deepEqual(seraphims[0]?.requiredJobs, ['Pirate']);
	assert.equal(seraphims[0]?.requirements.str, 150);
	assert.equal(seraphims[0]?.requirements.dex, 60);
	assert.equal(seraphims[0]?.requirements.int, 0);
	assert.equal(seraphims[0]?.requirements.luk, 0);
	assert.equal(seraphims[0]?.requirements.pop, 0);
	assert.equal(seraphims[0]?.stats.weaponAttack, 58);
	assert.equal(seraphims[0]?.stats.attackSpeed, 5);
	assert.equal(seraphims[0]?.stats.upgradeSlots, 7);

	const zenumistCape = searchKoreanItems('제뉴미스트의 망토', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		zenumistCape.map((item) => item.id),
		[1102139],
	);
	assert.equal(zenumistCape[0]?.stats.maxMp, 15);
	assert.equal(zenumistCape[0]?.stats.weaponDefense, 28);
	assert.equal(zenumistCape[0]?.stats.magicDefense, 33);
	assert.equal(zenumistCape[0]?.stats.speed, 7);
	assert.equal(zenumistCape[0]?.stats.jump, 3);

	const generatedKoreanName = searchKoreanItems('갈색가죽모자', { items: generatedItemIndex });
	assert.equal(generatedKoreanName[0]?.nameKo, '갈색 가죽 모자');
	assert.equal(generatedKoreanName[0]?.nameEn, 'Brown Skullcap');

	const generatedKoreanPartial = searchKoreanItems('스카이', { items: generatedItemIndex });
	assert.ok(generatedKoreanPartial.some((item) => item.nameKo.includes('스카이')));

	const spacedInitials = searchKoreanItems('드샤', { items: generatedItemIndex });
	assert.equal(spacedInitials[0]?.nameKo, '드래곤 샤인보우');
	assert.equal(spacedInitials[0]?.id, 1452044);

	const byName = searchKoreanItems('노가', { items: generatedItemIndex });
	assert.equal(byName[0]?.nameKo, '노가다 목장갑');
	assert.equal(byName[0]?.id, 1082002);
	assert.equal(byName[0]?.equipmentKind, '장갑');
	assert.equal(byName[0]?.requiredLevel, 10);
	assert.deepEqual(byName[0]?.requiredJobs, ['Beginner']);
	assert.equal(byName[0]?.stats.weaponDefense, 2);
	assert.equal(byName[0]?.stats.upgradeSlots, 5);

	const byAlias = searchKoreanItems('노목', { items: generatedItemIndex });
	assert.equal(byAlias[0]?.nameKo, '노가다 목장갑');
	assert.equal(byAlias[0]?.nameEn, 'Work Gloves');
	assert.ok(generatedItemIndex.some((item) => item.aliases.includes('노목')));

	const zakumByAlias = searchKoreanItems('자투', { items: generatedItemIndex });
	assert.equal(zakumByAlias[0]?.nameKo, '자쿰의 투구');
	assert.equal(zakumByAlias[0]?.id, 1002357);
	assert.equal(zakumByAlias[0]?.stats.str, 15);
	assert.equal(zakumByAlias[0]?.stats.upgradeSlots, 10);

	const zakumByEnglishName = searchKoreanItems('zakum helmet', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		zakumByEnglishName.map((item) => item.id),
		[1002357],
	);

	const englishName = searchKoreanItems('red craven', { items: generatedItemIndex });
	assert.equal(englishName[0]?.nameEn, 'Red Craven');
	assert.equal(englishName[0]?.nameKo, '레드 크리븐');
	assert.equal(englishName[0]?.equipmentKind, '아대');
	assert.equal(englishName[0]?.requiredLevel, 100);
	assert.deepEqual(englishName[0]?.requiredJobs, ['Thief']);
	assert.equal(englishName[0]?.requirements.dex, 140);
	assert.equal(englishName[0]?.requirements.luk, 290);
	assert.equal(englishName[0]?.stats.luk, 6);
	assert.equal(englishName[0]?.stats.weaponAttack, 46);
	assert.equal(englishName[0]?.stats.weaponDefense, 6);
	assert.equal(englishName[0]?.stats.upgradeSlots, 7);

	const blackScarab = searchKoreanItems('black scarab', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		blackScarab.map((item) => item.id),
		[1472029],
	);
	assert.equal(blackScarab[0]?.requiredLevel, 70);

	const unresolvedVariant = searchKoreanItems('루돌프의 빨간코', { items: generatedItemIndex, limit: 20 });
	assert.equal(unresolvedVariant.length, 10);
	assert.deepEqual(
		new Set(unresolvedVariant.map((item) => item.nameKo)),
		new Set([
			'루돌프의 빨간코 (STR)',
			'루돌프의 빨간코 (DEX)',
			'루돌프의 빨간코 (INT)',
			'루돌프의 빨간코 (LUK)',
			'루돌프의 빨간코 (공격력)',
			'루돌프의 빨간코 (물리방어력)',
			'루돌프의 빨간코 (마력)',
			'루돌프의 빨간코 (마법방어력)',
			'루돌프의 빨간코 (회피율)',
			'루돌프의 빨간코 (명중률)',
		]),
	);

	const mapleLeaf = searchKoreanItems('메이플 리프', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		new Set(mapleLeaf.map((item) => item.nameKo)),
		new Set(['메이플 리프 (STR)', '메이플 리프 (DEX)', '메이플 리프 (INT)', '메이플 리프 (LUK)']),
	);

	const whiteMouseKit = searchKoreanItems('화이트 마우스 분장', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		new Set(whiteMouseKit.map((item) => item.nameKo)),
		new Set([
			'화이트 마우스 분장 (이동속도)',
			'화이트 마우스 분장 (점프력)',
			'화이트 마우스 분장 (최대HP/MP)',
			'화이트 마우스 분장 (명중률)',
		]),
	);

	const agentReceiver = searchKoreanItems('요원C의 낡은 수신기', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		new Set(agentReceiver.map((item) => item.nameKo)),
		new Set(['요원C의 낡은 수신기', '요원C의 낡은 수신기 (LUK)', '요원C의 낡은 수신기 (DEX)']),
	);

	const archeologistHat = searchKoreanItems('고고학자의 모자', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		new Set(archeologistHat.map((item) => item.nameKo)),
		new Set(['고고학자의 모자 (1)', '고고학자의 모자 (3)']),
	);

	const archeologistGlasses = searchKoreanItems('고고학자의 안경', { items: generatedItemIndex, limit: 10 });
	assert.deepEqual(
		new Set(archeologistGlasses.map((item) => item.nameKo)),
		new Set(['고고학자의 안경 (1)', '고고학자의 안경 (3)']),
	);

	for (const hiddenQuery of [
		'메이플 1000일 깃발',
		'야비한 늑대 모자',
		'용감한 어린양 모자',
		'Ragged Red Cape',
		'카우보이 바지',
		'코-크 모자',
		'트레이닝웨어',
		'하트 슬리브리스',
	]) {
		assert.deepEqual(searchKoreanItems(hiddenQuery, { items: generatedItemIndex, limit: 10 }), []);
	}
});

test('item dedupe report records collapsed and unresolved groups', () => {
	assert.match(dedupeReport, /Raw item count: 2328/);
	assert.match(dedupeReport, /Visibility-hidden item count: 22/);
	assert.match(dedupeReport, /Missing-Korean-name hidden item count: 0/);
	assert.match(dedupeReport, /Equipment-kind hidden item count: 0/);
	assert.match(dedupeReport, /Zero-stat hidden item count: 0/);
	assert.match(dedupeReport, /Visibility-renamed item count: 28/);
	assert.match(dedupeReport, /Dedupe input item count: 2328/);
	assert.match(dedupeReport, /Deduped item count: 2098/);
	assert.match(dedupeReport, /Dedupe-hidden item count: 230/);
	assert.match(dedupeReport, /Exact-signature groups collapsed: 16/);
	assert.match(dedupeReport, /Variant highest-level groups collapsed: 82/);
	assert.match(dedupeReport, /Unresolved variant groups: 0/);
	assert.match(dedupeReport, /Hidden equipment kinds: Cash, Face, Hair, Medal, Mount, Pet Equipment, Skill Effect/);
	assert.match(equipmentKindReport, /Hidden equipment kinds: Cash, Face, Hair, Medal, Mount, Pet Equipment, Skill Effect/);
	for (const hiddenKind of ['Face', 'Hair', 'Mount', 'Pet Equipment', 'Skill Effect']) {
		assert.doesNotMatch(equipmentKindReport, new RegExp(`\\| ${hiddenKind} \\|`));
	}
	assert.doesNotMatch(equipmentKindReport, /\| Belt \|/);
	assert.match(equipmentKindReport, /\| 벨트 \| 14 \|/);
	assert.match(dedupeReport, /Renamed item ids: .*1102054, 1102055, 1102056/);
	assert.match(dedupeReport, /### 흑갑충 \/ Black Scarab \/ 아대/);
	assert.match(dedupeReport, /Kept: 1472029 Lv\.70/);
	assert.match(dedupeReport, /Hidden: 1472037, 1472042, 1472048/);
	assert.match(dedupeReport, /## Unresolved Variant Groups/);
	assert.doesNotMatch(dedupeReport, /### 루돌프의 빨간코 \/ Rudolph's Red Nose \/ 얼굴장식/);
	assert.match(duplicateGroupsReport, /Total duplicate groups: 0/);
	assert.match(duplicateGroupsReport, /Variant-signature groups: 0/);
	assert.match(duplicateGroupsReport, /Exact-signature groups: 0/);
});

test('item card formats enhanced stats with non-zero breakdown parts', () => {
	assert.match(indexSource, /formatStatBreakdownValue/);
	assert.match(indexSource, /const parts = \[breakdown\.original, breakdown\.maker, breakdown\.scroll\]/);
	assert.match(indexSource, /\.filter\(\(value, index\) => index === 0 \|\| value !== 0\)/);
	assert.match(indexSource, /key === 'attackSpeed'/);
	assert.match(indexSource, /key === 'upgradeSlots'/);
});

test('enhanced item card receives stat breakdown data', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');

	assert.match(enhancementPanelSource, /computeStatBreakdown/);
	assert.match(enhancementPanelSource, /const statBreakdown = computeStatBreakdown\(selectedBaseItem\.stats, enhancementState\);/);
	assert.match(enhancementPanelSource, /renderEnhancedItemCard\(selectedBaseItem,\s*accumulatedStats,\s*remaining,\s*appliedCount,\s*gradeColor,\s*statBreakdown,\s*itemLevelUpMeta\)/);

	assert.match(makerPanelSource, /computeStatBreakdown/);
	assert.match(makerPanelSource, /const statBreakdown = computeStatBreakdown\(selectedBaseItem\.stats, enhancementState\);/);
	assert.match(makerPanelSource, /renderEnhancedItemCard\(selectedBaseItem,\s*accumulatedStats,\s*remaining,\s*appliedCount,\s*gradeColor,\s*statBreakdown\)/);
});

test('enhancement reset button is placed below the selected item card', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.ok(indexSource.indexOf('data-selected-item-card') < indexSource.indexOf('data-enhancement-reset'));
	assert.ok(indexSource.indexOf('data-enhancement-reset') < indexSource.indexOf('</aside>'));
	assert.doesNotMatch(
		indexSource.slice(indexSource.indexOf('data-enhancement-active'), indexSource.indexOf('data-enhancement-reset')),
		/data-enhancement-reset/,
	);
	assert.match(enhancementPanelSource, /document\.querySelector\('\[data-enhancement-reset\]'\)/);
	assert.match(enhancementPanelSource, /resetButton\.hidden\s*=\s*false/);
	assert.match(enhancementPanelSource, /resetButton\.hidden\s*=\s*true/);
});

test('enhancement reset button has interactive hover and focus states without shadow', () => {
	const resetStylesStart = indexSource.indexOf('.selected-item-reset {');
	const resetStylesEnd = indexSource.indexOf('.selected-item-reset[hidden]', resetStylesStart);
	const resetInteractionStyles = indexSource.slice(resetStylesStart, resetStylesEnd);

	assert.match(indexSource, /\.selected-item-reset\s*\{[^}]*transition:/);
	assert.match(indexSource, /\.selected-item-reset:hover\s*\{[^}]*transform:\s*translateY\(-1px\)/);
	assert.match(indexSource, /\.selected-item-reset:active\s*\{[^}]*transform:\s*translateY\(0\)/);
	assert.match(indexSource, /\.selected-item-reset:focus-visible\s*\{[^}]*outline:/);
	assert.doesNotMatch(resetInteractionStyles, /box-shadow/);
});

test('scroll list exposes single-select stat filters beside its title', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.match(indexSource, /data-scroll-list-heading/);
	assert.match(indexSource, /data-scroll-stat-filters/);
	assert.ok(indexSource.indexOf('data-scroll-list-heading') < indexSource.indexOf('data-scroll-list>'));
	assert.match(enhancementPanelSource, /let activeScrollStatFilter\s*=\s*'all'/);
	assert.match(enhancementPanelSource, /const renderScrollStatFilters\s*=\s*\(available\)\s*=>/);
	assert.match(enhancementPanelSource, /button\.dataset\.scrollStatFilter\s*=\s*key/);
	assert.match(enhancementPanelSource, /button\.textContent\s*=\s*key === 'all' \? '전체' : \(statLabelByKey\[key\] \?\? key\)/);
	assert.match(enhancementPanelSource, /scrollStats\.has\(activeScrollStatFilter\)/);
	assert.match(enhancementPanelSource, /activeScrollStatFilter\s*=\s*button\.dataset\.scrollStatFilter/);
});

test('item level-up toggle is gated to reverse and timeless definitions', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.match(enhancementPanelSource, /const supportsItemLevelUp\s*=\s*\(levelUpDefinition\)\s*=>/);
	assert.match(enhancementPanelSource, /new Set\(\['reverse', 'timeless'\]\)/);
	assert.match(enhancementPanelSource, /supportsItemLevelUp\(levelUpDefinition\) \? levelUpDefinition : null/);
	assert.match(indexSource, /:global\(\.maker-toggle-button\[hidden\]\)\s*\{[^}]*display:\s*none;/);
});

test('item level-up metadata renders under requirement stats on supported item cards', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.match(indexSource, /const appendItemLevelUpCardMeta\s*=\s*\(meta\)\s*=>/);
	assert.match(indexSource, /selectedItemRequirements\.append\(createItemLine\('ITEM LEV', meta\.itemLevel,\s*'selected-item-line--item-level'\)\)/);
	assert.match(indexSource, /selectedItemRequirements\.append\(createItemLine\('ITEM EXP', meta\.itemExp,\s*'selected-item-line--item-level'\)\)/);
	assert.match(enhancementPanelSource, /computeItemLevelUpCardMeta/);
	assert.match(enhancementPanelSource, /computeItemLevelUpCardMeta\(enhancementState,\s*selectedItemLevelUpDefinition\)/);
	assert.match(enhancementPanelSource, /renderEnhancedItemCard\(selectedBaseItem,\s*accumulatedStats,\s*remaining,\s*appliedCount,\s*gradeColor,\s*statBreakdown,\s*itemLevelUpMeta\)/);
});

test('item card requirement rows align to icon height and item level rows are accented', async () => {
	assert.match(indexSource, /const createItemLine\s*=\s*\(label,\s*value,\s*className\s*=\s*''\)\s*=>/);
	assert.match(indexSource, /row\.className\s*=\s*`selected-item-line \$\{className\}`\.trim\(\)/);
	assert.match(indexSource, /createItemLine\(label,\s*value,\s*'selected-item-line--requirement'\)/);
	assert.match(indexSource, /createItemLine\('ITEM LEV',\s*meta\.itemLevel,\s*'selected-item-line--item-level'\)/);
	assert.match(indexSource, /createItemLine\('ITEM EXP',\s*meta\.itemExp,\s*'selected-item-line--item-level'\)/);
	assert.match(indexSource, /\.selected-item-icon-frame\s*\{[^}]*width:\s*96px;[^}]*height:\s*96px;/);
	assert.match(indexSource, /\.selected-item-requirements\s*\{[^}]*gap:\s*0;/);
	assert.match(indexSource, /:global\(\.selected-item-line--requirement\)\s*\{[^}]*height:\s*16px;[^}]*line-height:\s*16px;/);
	assert.match(indexSource, /:global\(\.selected-item-line--item-level\)\s*\{[^}]*color:\s*#c28b39;/);
});

test('item level-up panel source contract is present beside maker controls', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.match(indexSource, /data-item-level-up-toggle/);
	assert.match(indexSource, /아이템 레벨업/);
	assert.match(indexSource, /data-item-level-up-area/);
	assert.match(indexSource, /data-item-level-up-slots/);
	assert.match(indexSource, /data-item-level-up-editor/);
	assert.ok(indexSource.indexOf('data-maker-toggle') < indexSource.indexOf('data-item-level-up-toggle'));
	assert.match(indexSource, /:global\(\.item-level-up-slot\)/);
	assert.match(indexSource, /:global\(\.item-level-up-editor\)/);
	assert.match(enhancementPanelSource, /initItemLevelUpPanel/);
});

test('item level-up panel applies bounded slot values and auto-advances', async () => {
	const panelSource = await readFile(new URL('../src/lib/itemLevelUpPanel.mjs', import.meta.url), 'utf8');

	assert.match(panelSource, /applyItemLevelUp/);
	assert.match(panelSource, /clearItemLevelUpSlot/);
	assert.match(panelSource, /Math\.max\(range\.min,\s*Math\.min\(range\.max,/);
	assert.match(panelSource, /minBtn\.textContent\s*=\s*'MIN'/);
	assert.match(panelSource, /maxBtn\.textContent\s*=\s*'MAX'/);
	assert.match(panelSource, /findNextEmptySlotIndex/);
	assert.match(panelSource, /renderEditor\(nextEmpty\)/);
	assert.match(panelSource, /editor\.hidden\s*=\s*true/);
	assert.match(panelSource, /item-level-up-toggle--active/);
	assert.match(indexSource, /:global\(\.item-level-up-toggle--active\)/);
});

test('enhancement panel loads item level-up runtime data', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	assert.match(enhancementPanelSource, /fetch\('\/data\/item-level-ups-gms83-ko\.json'\)/);
	assert.match(enhancementPanelSource, /itemLevelUpByItemId\s*=\s*new Map/);
	assert.match(enhancementPanelSource, /levelUpDefinition\.itemId/);
});
