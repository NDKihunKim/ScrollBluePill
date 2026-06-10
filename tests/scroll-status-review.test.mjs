import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

import {
	allowedScrollStatuses,
	buildStatusUpdatePayload,
	filterDesiredPercentScrolls,
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
		parseScrollSelection('1', sampleScrolls).map((scroll) => scroll.id),
		['11111111-1111-4111-8111-111111111111'],
	);

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

	assert.deepEqual(
		parseScrollSelection('33333333-3333-4333-8333-333333333333', sampleScrolls).map((scroll) => scroll.id),
		['33333333-3333-4333-8333-333333333333'],
	);
});

test('parseScrollSelection accepts canonical UUIDs beyond older version nibbles', () => {
	const scrolls = [
		{
			id: '77777777-7777-7777-9777-777777777777',
			name_ko: '테스트 주문서',
			category: '테스트',
			behavior_type: 'fixed',
			published_status: 'draft',
			affected_stats: [],
		},
	];

	assert.deepEqual(
		parseScrollSelection('77777777-7777-7777-9777-777777777777', scrolls).map((scroll) => scroll.id),
		['77777777-7777-7777-9777-777777777777'],
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

test('filterDesiredPercentScrolls keeps 10%, 60%, and 100% scrolls only', () => {
	const scrolls = [
		{
			id: 'a0000000-0000-4000-8000-000000000001',
			name_ko: '장갑 공격력 주문서 10%',
			category: '장갑',
			behavior_type: 'fixed',
			published_status: 'published',
			affected_stats: ['weaponAttack'],
		},
		{
			id: 'a0000000-0000-4000-8000-000000000002',
			name_ko: '장갑 공격력 주문서 30%',
			category: '장갑',
			behavior_type: 'fixed',
			published_status: 'published',
			affected_stats: ['weaponAttack'],
		},
		{
			id: 'a0000000-0000-4000-8000-000000000003',
			name_ko: '장갑 공격력 주문서 60%',
			category: '장갑',
			behavior_type: 'fixed',
			published_status: 'published',
			affected_stats: ['weaponAttack'],
		},
		{
			id: 'a0000000-0000-4000-8000-000000000004',
			name_ko: '장갑 공격력 주문서 70%',
			category: '장갑',
			behavior_type: 'fixed',
			published_status: 'published',
			affected_stats: ['weaponAttack'],
		},
		{
			id: 'a0000000-0000-4000-8000-000000000005',
			name_ko: '장갑 공격력 주문서 100%',
			category: '장갑',
			behavior_type: 'fixed',
			published_status: 'published',
			affected_stats: ['weaponAttack'],
		},
		{
			id: 'a0000000-0000-4000-8000-000000000006',
			name_ko: '장갑 마력 주문서 60%',
			category: '장갑',
			behavior_type: 'fixed',
			published_status: 'published',
			affected_stats: ['magicAttack'],
		},
		{
			id: 'a0000000-0000-4000-8000-000000000007',
			name_ko: '장갑 마력 주문서 70%',
			category: '장갑',
			behavior_type: 'fixed',
			published_status: 'published',
			affected_stats: ['magicAttack'],
		},
		{
			id: 'a0000000-0000-4000-8000-000000000008',
			name_ko: '환생의 주문서',
			category: '장갑',
			behavior_type: 'fixed',
			published_status: 'published',
			affected_stats: [],
		},
	];

	const result = filterDesiredPercentScrolls(scrolls);

	assert.deepEqual(
		result.map((s) => s.id),
		[
			'a0000000-0000-4000-8000-000000000001', // 10%
			'a0000000-0000-4000-8000-000000000003', // 60%
			'a0000000-0000-4000-8000-000000000005', // 100%
			'a0000000-0000-4000-8000-000000000006', // 60% magicAttack
		],
	);
});

test('filterDesiredPercentScrolls handles empty array', () => {
	assert.deepEqual(filterDesiredPercentScrolls([]), []);
});

test('filterDesiredPercentScrolls drops scrolls without percent in name', () => {
	const scrolls = [
		{
			id: 'b0000000-0000-4000-8000-000000000001',
			name_ko: '혼돈의 주문서',
			category: '장갑',
			behavior_type: 'random',
			published_status: 'published',
			affected_stats: [],
		},
	];

	assert.deepEqual(filterDesiredPercentScrolls(scrolls), []);
});

test('review script source uses service role and patches only published_status', async () => {
	const source = await readFile(new URL('../scripts/review-scroll-status.mjs', import.meta.url), 'utf8');

	assert.match(source, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
	assert.doesNotMatch(source, /process\.env\.SUPABASE_ANON_KEY/);
	assert.match(
		source,
		/const\s+payload\s*=\s*buildStatusUpdatePayload\([^)]*\);[\s\S]*method:\s*'PATCH'[\s\S]*body:\s*JSON\.stringify\(payload\)/,
	);
});

test('package exposes review:scrolls and env example documents service role use', async () => {
	const packageJson = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
	const envExample = await readFile(new URL('../.env.example', import.meta.url), 'utf8');

	assert.equal(packageJson.scripts['review:scrolls'], 'node --env-file=.env scripts/review-scroll-status.mjs');
	assert.match(envExample, /review:scrolls admin workflows/);
	assert.match(envExample, /SUPABASE_SERVICE_ROLE_KEY=/);
});
