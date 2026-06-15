import assert from 'node:assert/strict';
import test from 'node:test';

const FORMATTER_MODULE = '../src/lib/expectedValue/resultFormatter.mjs';

test('formatProbability(0.15) returns "15.00%"', async () => {
  const { formatProbability } = await import(FORMATTER_MODULE);
  assert.equal(formatProbability(0.15), '15.00%');
});

test('formatProbability(0.01) returns "1.00%"', async () => {
  const { formatProbability } = await import(FORMATTER_MODULE);
  assert.equal(formatProbability(0.01), '1.00%');
});

test('formatProbability(0.00001) returns scientific notation', async () => {
  const { formatProbability } = await import(FORMATTER_MODULE);
  // 0.00001 * 100 = 0.001 < 0.01, so scientific notation: 1.00×10⁻³%
  assert.equal(formatProbability(0.00001), '1.00×10⁻³%');
});

test('formatProbability(1.0) returns "100.00%"', async () => {
  const { formatProbability } = await import(FORMATTER_MODULE);
  assert.equal(formatProbability(1.0), '100.00%');
});

test('formatProbability(0) returns "0%"', async () => {
  const { formatProbability } = await import(FORMATTER_MODULE);
  assert.equal(formatProbability(0), '0%');
});

test('formatCalculationLabel(true, 0) returns "정확 계산"', async () => {
  const { formatCalculationLabel } = await import(FORMATTER_MODULE);
  assert.equal(formatCalculationLabel(true, 0), '정확 계산');
});

test('formatCalculationLabel(false, 100000) returns simulation label with locale comma', async () => {
  const { formatCalculationLabel } = await import(FORMATTER_MODULE);
  assert.equal(
    formatCalculationLabel(false, 100000),
    '시뮬레이션 추정 · 100,000회'
  );
});

test('isResultStale(100000, 100000) returns false', async () => {
  const { isResultStale } = await import(FORMATTER_MODULE);
  assert.equal(isResultStale(100000, 100000), false);
});

test('isResultStale(100000, 50000) returns true', async () => {
  const { isResultStale } = await import(FORMATTER_MODULE);
  assert.equal(isResultStale(100000, 50000), true);
});

test('createResultSummary returns structured result with all required fields', async () => {
  const { createResultSummary } = await import(FORMATTER_MODULE);
  const result = createResultSummary({
    successProbability: 0.5,
    isExact: true,
    trialCount: 100000,
    bestStrategy: { name: 'test' },
  });

  assert.equal(result.successProbability, 0.5);
  assert.equal(typeof result.probabilityLabel, 'string');
  assert.equal(result.calculationLabel, '정확 계산');
  assert.equal(result.isExact, true);
  assert.equal(result.trialCount, 100000);
  assert.equal(typeof result.expectedAttempts, 'number');
  assert.ok(result.percentiles !== undefined && result.percentiles !== null);
  assert.equal(typeof result.percentiles.p50, 'number');
  assert.equal(typeof result.percentiles.p75, 'number');
  assert.equal(typeof result.percentiles.p90, 'number');
  assert.equal(typeof result.percentiles.p95, 'number');
  assert.ok(Array.isArray(result.chartData));
  assert.ok(result.bestStrategy !== undefined);
  assert.deepEqual(result.bestStrategy, { name: 'test' });
});

test('createResultSummary with p=1.0 returns 1 for all attempt metrics', async () => {
  const { createResultSummary } = await import(FORMATTER_MODULE);
  const result = createResultSummary({
    successProbability: 1.0,
    isExact: true,
    trialCount: 100000,
  });

  assert.equal(result.expectedAttempts, 1);
  assert.equal(result.percentiles.p50, 1);
  assert.equal(result.percentiles.p75, 1);
  assert.equal(result.percentiles.p90, 1);
  assert.equal(result.percentiles.p95, 1);
});

test('createResultSummary generates correct chart data length', async () => {
  const { createResultSummary } = await import(FORMATTER_MODULE);
  const result = createResultSummary({
    successProbability: 0.5,
    isExact: true,
    trialCount: 100000,
  });

  // Inverse CDF: 100 points from 0% to 99% for p=0.5
  assert.equal(result.chartData.length, 100);
  assert.equal(result.chartData[0].percentile, 0);
  assert.equal(result.chartData[0].attempts, 0);
  // At percentile=50, attempts = ceil(log(0.5)/log(0.5)) = 1
  assert.equal(result.chartData[50].percentile, 50);
  assert.equal(result.chartData[50].attempts, 1);

  for (const entry of result.chartData) {
    assert.equal(typeof entry.percentile, 'number');
    assert.equal(typeof entry.attempts, 'number');
  }
});
