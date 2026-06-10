import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	allowedScrollStatuses,
	buildStatusUpdatePayload,
	groupScrollsByCategory,
	parseScrollSelection,
	validateScrollStatus,
} from '../src/lib/scrollStatusReview.mjs';

const sampleScrolls = [
	{
		id: '11111111-1111-4111-8111-111111111111',
		name_ko: '장갑 공격력 주문서 60%',
		category: '장갑',
		behavior_type: 'fixed',
		published_status: 'published',
		affected_stats: ['weaponAttack'],
	},
	{
		id: '22222222-2222-4222-8222-222222222222',
		name_ko: '장갑 민첩성 주문서 10%',
		category: '장갑',
		behavior_type: 'random',
		published_status: 'hidden',
		affected_stats: ['dex'],
	},
	{
		id: '33333333-3333-4333-8333-333333333333',
		name_ko: '귀고리 지력 주문서 60%',
		category: '귀고리',
		behavior_type: 'fixed',
		published_status: 'draft',
		affected_stats: ['int'],
	},
];

test('allowed scroll statuses are exactly the database statuses', () => {
	assert.deepEqual(allowedScrollStatuses, ['draft', 'published', 'hidden']);
	assert.equal(validateScrollStatus('draft'), 'draft');
	assert.equal(validateScrollStatus('published'), 'published');
	assert.equal(validateScrollStatus('hidden'), 'hidden');
	assert.throws(() => validateScrollStatus('archived'), /Invalid scroll status/);
});

test('buildStatusUpdatePayload only includes published_status', () => {
	assert.deepEqual(buildStatusUpdatePayload('hidden'), { published_status: 'hidden' });
	assert.throws(() => buildStatusUpdatePayload('deleted'), /Invalid scroll status/);
});

test('groupScrollsByCategory sorts categories and scroll names using Korean locale', () => {
	const groups = groupScrollsByCategory(sampleScrolls);

	assert.deepEqual(groups.map((group) => group.category), ['귀고리', '장갑']);
	assert.deepEqual(
		groups.find((group) => group.category === '장갑').scrolls.map((scroll) => scroll.name_ko),
		['장갑 공격력 주문서 60%', '장갑 민첩성 주문서 10%'],
	);
});

test('parseScrollSelection accepts single numbers, comma lists, ranges, and UUIDs', () => {
	assert.deepEqual(
		parseScrollSelection('1,2', sampleScrolls).map((scroll) => scroll.id),
		[
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
		],
	);

	assert.deepEqual(
		parseScrollSelection('1-2', sampleScrolls).map((scroll) => scroll.id),
		[
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
		],
	);

	assert.deepEqual(
		parseScrollSelection('1,2,2,11111111-1111-4111-8111-111111111111', sampleScrolls).map((scroll) => scroll.id),
		[
			'11111111-1111-4111-8111-111111111111',
			'22222222-2222-4222-8222-222222222222',
		],
	);
});

test('parseScrollSelection rejects unsafe or unknown input before writes', () => {
	assert.throws(() => parseScrollSelection('', sampleScrolls), /Select at least one scroll/);
	assert.throws(() => parseScrollSelection('0', sampleScrolls), /Selection number out of range/);
	assert.throws(() => parseScrollSelection('4', sampleScrolls), /Selection number out of range/);
	assert.throws(() => parseScrollSelection('3-1', sampleScrolls), /Range start must be less than or equal to range end/);
	assert.throws(() => parseScrollSelection('abc', sampleScrolls), /Invalid selection token/);
	assert.throws(
		() => parseScrollSelection('99999999-9999-4999-8999-999999999999', sampleScrolls),
		/Unknown scroll id/,
	);
});

test('review script source uses service role and patches only published_status', async () => {
	const source = await readFile(new URL('../scripts/review-scroll-status.mjs', import.meta.url), 'utf8');

	assert.match(source, /SUPABASE_SERVICE_ROLE_KEY/);
	assert.doesNotMatch(source, /SUPABASE_ANON_KEY/);
	assert.match(source, /buildStatusUpdatePayload/);
	assert.match(source, /method:\s*'PATCH'/);
	assert.doesNotMatch(source, /name_ko:\s*/);
	assert.doesNotMatch(source, /category:\s*/);
	assert.doesNotMatch(source, /behavior_type:\s*/);
	assert.doesNotMatch(source, /affected_stats:\s*/);
});
