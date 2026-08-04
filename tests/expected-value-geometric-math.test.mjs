import assert from 'node:assert/strict';
import test from 'node:test';

const GEOM_MODULE = '../src/lib/expectedValue/geometricMath.mjs';

// ---------------------------------------------------------------------------
// Geometric distribution math
// ---------------------------------------------------------------------------

test('computeGeometricPercentiles for p=0.5', async () => {
  const { computeGeometricPercentiles } = await import(GEOM_MODULE);

  const result = computeGeometricPercentiles(0.5);

  assert.equal(result.p50, 1);
  assert.equal(result.p75, 2);
  assert.equal(result.p90, 4);
  assert.equal(result.p95, 5);
});

test('computeGeometricPercentiles for p=1.0 returns all 1s', async () => {
  const { computeGeometricPercentiles } = await import(GEOM_MODULE);

  const result = computeGeometricPercentiles(1.0);

  assert.equal(result.p50, 1);
  assert.equal(result.p75, 1);
  assert.equal(result.p90, 1);
  assert.equal(result.p95, 1);
});

test('computeExpectedAttempts for p=0.5 returns 2', async () => {
  const { computeExpectedAttempts } = await import(GEOM_MODULE);

  assert.equal(computeExpectedAttempts(0.5), 2);
});

test('computeExpectedAttempts for p=1.0 returns 1', async () => {
  const { computeExpectedAttempts } = await import(GEOM_MODULE);

  assert.equal(computeExpectedAttempts(1.0), 1);
});

test('computeCumulativeProbability returns 1 - (1-p)^n', async () => {
  const { computeCumulativeProbability } = await import(GEOM_MODULE);

  const result = computeCumulativeProbability(0.1, 1);
  assert.ok(Math.abs(result - 0.1) < 1e-9, `expected ~0.1, got ${result}`);
});

test('computeCumulativeProbability for n=10, p=0.1 ≈ 0.6513', async () => {
  const { computeCumulativeProbability } = await import(GEOM_MODULE);

  const result = computeCumulativeProbability(0.1, 10);
  assert.ok(Math.abs(result - 0.6513215599) < 1e-9, `expected ~0.6513, got ${result}`);
});

test('computeCumulativeProbability for p=1.0 always returns 1', async () => {
  const { computeCumulativeProbability } = await import(GEOM_MODULE);

  assert.equal(computeCumulativeProbability(1.0, 1), 1);
  assert.equal(computeCumulativeProbability(1.0, 100), 1);
});

test('computeCumulativeProbability for p=0 returns 0', async () => {
  const { computeCumulativeProbability } = await import(GEOM_MODULE);

  assert.equal(computeCumulativeProbability(0, 1), 0);
  assert.equal(computeCumulativeProbability(0, 100), 0);
});

test('computeCumulativeProbability for n=0 returns 0', async () => {
  const { computeCumulativeProbability } = await import(GEOM_MODULE);

  assert.equal(computeCumulativeProbability(0.5, 0), 0);
});

test('computeCumulativeProbability for n=1 equals p', async () => {
  const { computeCumulativeProbability } = await import(GEOM_MODULE);

  const p = 0.35;
  assert.equal(computeCumulativeProbability(p, 1), p);
});

