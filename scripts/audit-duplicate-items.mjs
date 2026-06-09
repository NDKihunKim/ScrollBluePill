import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { armorKinds, weaponKinds } from '../src/lib/calculatorInput.mjs';
import { groupDuplicateItems, itemDedupeSignature } from '../src/lib/itemDedupe.mjs';

const itemIndexPath = resolve('public/data/items-gms83-ko.json');
const reportPath = resolve('docs/data-quality/duplicate-item-groups.md');
const calculatorEquipmentKinds = new Set([...weaponKinds, ...armorKinds]);

function formatStats(stats = {}) {
	const entries = Object.entries(stats).filter(([, value]) => Number.isFinite(value));

	if (entries.length === 0) {
		return '-';
	}

	return entries.map(([key, value]) => `${key}:${value}`).join(', ');
}

function pickCandidateCanonical(group) {
	return [...group].sort((a, b) => {
		const levelDelta = b.requiredLevel - a.requiredLevel;
		if (levelDelta !== 0) {
			return levelDelta;
		}

		const attackDelta = (b.stats?.weaponAttack ?? 0) - (a.stats?.weaponAttack ?? 0);
		if (attackDelta !== 0) {
			return attackDelta;
		}

		return a.id - b.id;
	})[0];
}

const items = JSON.parse(await readFile(itemIndexPath, 'utf8'));
const relevantItems = items.filter((item) => calculatorEquipmentKinds.has(item.equipmentKind));
const duplicateGroups = groupDuplicateItems(relevantItems)
	.map((group) => {
		const signatures = new Set(group.map(itemDedupeSignature));
		return {
			nameKo: group[0].nameKo,
			nameEn: group[0].nameEn,
			equipmentKind: group[0].equipmentKind,
			count: group.length,
			kind: signatures.size === 1 ? 'exact-signature' : 'variant-signature',
			candidateCanonical: pickCandidateCanonical(group),
			items: [...group].sort((a, b) => a.requiredLevel - b.requiredLevel || a.id - b.id),
		};
	})
	.sort((a, b) => {
		if (a.kind !== b.kind) {
			return a.kind === 'variant-signature' ? -1 : 1;
		}

		return b.count - a.count || a.nameKo.localeCompare(b.nameKo, 'ko-KR');
	});

const lines = [
	'# Duplicate Item Groups',
	'',
	'Generated from `public/data/items-gms83-ko.json`.',
	'',
	'Grouping key: `nameKo + nameEn + equipmentKind` within calculator-supported equipment kinds.',
	'',
	'Review guidance:',
	'- `variant-signature`: same display name but different level, requirements, jobs, or stats. Review before hiding anything.',
	'- `exact-signature`: same display name and same generated stat signature. These are stronger dedupe candidates, but still keep source ids traceable.',
	'- `candidate canonical` is a heuristic only: highest required level, then highest weapon attack, then lowest id.',
	'',
	`Total duplicate groups: ${duplicateGroups.length}`,
	`Variant-signature groups: ${duplicateGroups.filter((group) => group.kind === 'variant-signature').length}`,
	`Exact-signature groups: ${duplicateGroups.filter((group) => group.kind === 'exact-signature').length}`,
	'',
];

for (const group of duplicateGroups) {
	lines.push(
		`## ${group.nameKo} / ${group.nameEn} / ${group.equipmentKind}`,
		'',
		`Type: \`${group.kind}\``,
		`Candidate canonical: \`${group.candidateCanonical.id}\` Lv.${group.candidateCanonical.requiredLevel}`,
		'',
		'| ID | Level | Jobs | Requirements | Stats |',
		'| --- | ---: | --- | --- | --- |',
	);

	for (const item of group.items) {
		lines.push(
			`| ${item.id} | ${item.requiredLevel} | ${(item.requiredJobs ?? []).join(', ') || '-'} | ${formatStats(
				item.requirements,
			)} | ${formatStats(item.stats)} |`,
		);
	}

	lines.push('');
}

await mkdir(dirname(reportPath), { recursive: true });
await writeFile(reportPath, `${lines.join('\n')}\n`);

console.log(`Wrote ${reportPath}`);
console.log(`Duplicate groups: ${duplicateGroups.length}`);
console.log(`Variant-signature groups: ${duplicateGroups.filter((group) => group.kind === 'variant-signature').length}`);
console.log(`Exact-signature groups: ${duplicateGroups.filter((group) => group.kind === 'exact-signature').length}`);
