import assert from 'node:assert/strict';
import test from 'node:test';

test('SCROLL_PERCENT_PATTERN matches percent values in names', async () => {
	const { SCROLL_PERCENT_PATTERN } = await import('../src/lib/expectedValue/scrollModel.mjs');

	assert.equal(SCROLL_PERCENT_PATTERN instanceof RegExp, true);
	assert.equal(SCROLL_PERCENT_PATTERN.test('공격력의 주문서 10%'), true);
	assert.equal(SCROLL_PERCENT_PATTERN.test('방어력의 주문서 60%'), true);
	assert.equal(SCROLL_PERCENT_PATTERN.test('장인의 주문서 100%'), true);
	assert.equal(SCROLL_PERCENT_PATTERN.test('혼돈의 주문서'), false);
	assert.equal(SCROLL_PERCENT_PATTERN.test('공 10% 주문서 (방어구)'), true);

	const match = '공격력의 주문서 10%'.match(SCROLL_PERCENT_PATTERN);
	assert.equal(match[1], '10');
});

test('parseScrollSuccessRate extracts 10% from name', async () => {
	const { parseScrollSuccessRate } = await import('../src/lib/expectedValue/scrollModel.mjs');

	const result = parseScrollSuccessRate('공격력의 주문서 10%');
	assert.equal(result, 0.1);
});

test('parseScrollSuccessRate extracts 60% from name', async () => {
	const { parseScrollSuccessRate } = await import('../src/lib/expectedValue/scrollModel.mjs');

	const result = parseScrollSuccessRate('방어력의 주문서 60%');
	assert.equal(result, 0.6);
});

test('parseScrollSuccessRate extracts 100% from name', async () => {
	const { parseScrollSuccessRate } = await import('../src/lib/expectedValue/scrollModel.mjs');

	const result = parseScrollSuccessRate('장인의 주문서 100%');
	assert.equal(result, 1.0);
});

test('parseScrollSuccessRate defaults to 100% when no percent suffix', async () => {
	const { parseScrollSuccessRate } = await import('../src/lib/expectedValue/scrollModel.mjs');

	const result = parseScrollSuccessRate('혼돈의 주문서');
	assert.equal(result, 1.0);
});

test('parseScrollSuccessRate handles percent in middle of name', async () => {
	const { parseScrollSuccessRate } = await import('../src/lib/expectedValue/scrollModel.mjs');

	const result = parseScrollSuccessRate('공 10% 주문서 (방어구)');
	assert.equal(result, 0.1);
});

test('parseScrollSuccessRate handles edge case: 0%', async () => {
	const { parseScrollSuccessRate } = await import('../src/lib/expectedValue/scrollModel.mjs');

	const result = parseScrollSuccessRate('실패 보장의 주문서 0%');
	assert.equal(result, 0.0);
});

test('parseScrollSuccessRate handles edge case: percent > 100', async () => {
	const { parseScrollSuccessRate } = await import('../src/lib/expectedValue/scrollModel.mjs');

	const result = parseScrollSuccessRate('초월의 주문서 200%');
	assert.equal(result, 1.0);
});

test('parseScrollSuccessRate handles null/undefined name', async () => {
	const { parseScrollSuccessRate } = await import('../src/lib/expectedValue/scrollModel.mjs');

	assert.equal(parseScrollSuccessRate(null), 1.0);
	assert.equal(parseScrollSuccessRate(undefined), 1.0);
});
