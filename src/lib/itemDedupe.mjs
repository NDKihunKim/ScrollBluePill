export function duplicateGroupKey(item) {
	return `${item.nameKo}||${item.nameEn}||${item.equipmentKind}`;
}

export function itemDedupeSignature(item) {
	return JSON.stringify({
		requiredLevel: item.requiredLevel,
		requiredJobs: item.requiredJobs ?? [],
		requirements: item.requirements ?? {},
		stats: item.stats ?? {},
	});
}

export function groupDuplicateItems(items) {
	const groups = new Map();

	for (const item of items) {
		const key = duplicateGroupKey(item);
		if (!groups.has(key)) {
			groups.set(key, []);
		}
		groups.get(key).push(item);
	}

	return [...groups.values()].filter((group) => group.length > 1);
}

export function resolveDuplicateGroup(group) {
	const signatures = new Set(group.map(itemDedupeSignature));

	if (signatures.size === 1) {
		const kept = [...group].sort((a, b) => a.id - b.id)[0];
		return {
			action: 'collapse-exact',
			kept,
			hidden: group.filter((item) => item.id !== kept.id),
			reason: 'same generated signature',
		};
	}

	const highestLevel = Math.max(...group.map((item) => item.requiredLevel));
	const highestLevelItems = group.filter((item) => item.requiredLevel === highestLevel);

	if (highestLevelItems.length === 1) {
		const kept = highestLevelItems[0];
		return {
			action: 'collapse-variant-highest-level',
			kept,
			hidden: group.filter((item) => item.id !== kept.id),
			reason: 'single highest required level',
		};
	}

	return {
		action: 'unresolved-variant',
		kept: null,
		hidden: [],
		reason: 'multiple items share the highest required level',
	};
}

export function dedupeItems(items) {
	const duplicateGroups = groupDuplicateItems(items);
	const hiddenIds = new Set();
	const resolutions = [];

	for (const group of duplicateGroups) {
		const resolution = resolveDuplicateGroup(group);
		resolutions.push({
			...resolution,
			group,
		});

		for (const hiddenItem of resolution.hidden) {
			hiddenIds.add(hiddenItem.id);
		}
	}

	return {
		items: items.filter((item) => !hiddenIds.has(item.id)),
		resolutions,
		hiddenIds,
	};
}
