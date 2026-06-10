export const allowedScrollStatuses = ['draft', 'published', 'hidden'];

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateScrollStatus(status) {
	if (!allowedScrollStatuses.includes(status)) {
		throw new Error(`Invalid scroll status: ${status}. Allowed statuses: ${allowedScrollStatuses.join(', ')}`);
	}

	return status;
}

export function buildStatusUpdatePayload(status) {
	return {
		published_status: validateScrollStatus(status),
	};
}

export function groupScrollsByCategory(scrolls) {
	const byCategory = new Map();

	for (const scroll of scrolls) {
		const category = scroll.category || '(none)';

		if (!byCategory.has(category)) {
			byCategory.set(category, []);
		}

		byCategory.get(category).push(scroll);
	}

	return [...byCategory.entries()]
		.sort(([a], [b]) => String(a).localeCompare(String(b), 'ko-KR'))
		.map(([category, categoryScrolls]) => ({
			category,
			scrolls: [...categoryScrolls].sort((a, b) =>
				String(a.name_ko).localeCompare(String(b.name_ko), 'ko-KR') || String(a.id).localeCompare(String(b.id)),
			),
		}));
}

export function parseScrollSelection(input, displayedScrolls) {
	const trimmed = input.trim();

	if (!trimmed) {
		throw new Error('Select at least one scroll.');
	}

	const selected = [];
	const selectedIds = new Set();
	const byId = new Map(displayedScrolls.map((scroll) => [String(scroll.id).toLowerCase(), scroll]));

	function addScroll(scroll) {
		const id = String(scroll.id);

		if (selectedIds.has(id)) {
			return;
		}

		selectedIds.add(id);
		selected.push(scroll);
	}

	for (const token of trimmed.split(',').map((part) => part.trim()).filter(Boolean)) {
		const rangeMatch = token.match(/^(\d+)-(\d+)$/);

		if (rangeMatch) {
			const start = Number(rangeMatch[1]);
			const end = Number(rangeMatch[2]);

			if (start > end) {
				throw new Error(`Range start must be less than or equal to range end: ${token}`);
			}

			for (let number = start; number <= end; number += 1) {
				const scroll = displayedScrolls[number - 1];

				if (!scroll) {
					throw new Error(`Selection number out of range: ${number}`);
				}

				addScroll(scroll);
			}

			continue;
		}

		if (/^\d+$/.test(token)) {
			const number = Number(token);
			const scroll = displayedScrolls[number - 1];

			if (!scroll) {
				throw new Error(`Selection number out of range: ${number}`);
			}

			addScroll(scroll);
			continue;
		}

		if (uuidPattern.test(token)) {
			const scroll = byId.get(token.toLowerCase());

			if (!scroll) {
				throw new Error(`Unknown scroll id: ${token}`);
			}

			addScroll(scroll);
			continue;
		}

		throw new Error(`Invalid selection token: ${token}`);
	}

	if (selected.length === 0) {
		throw new Error('Select at least one scroll.');
	}

	return selected;
}

export function formatAffectedStats(stats) {
	return Array.isArray(stats) && stats.length > 0 ? stats.join(', ') : '-';
}
