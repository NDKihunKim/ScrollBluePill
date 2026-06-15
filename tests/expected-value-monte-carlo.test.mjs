import assert from 'node:assert/strict';
import test from 'node:test';

const RNG_MODULE = '../src/lib/expectedValue/monteCarloEngine.mjs';

test('createSeededRng produces deterministic sequence', async () => {
  const { createSeededRng } = await import(RNG_MODULE);

  const rng1 = createSeededRng(42);
  const rng2 = createSeededRng(42);

  const seq1 = Array.from({ length: 10 }, () => rng1());
  const seq2 = Array.from({ length: 10 }, () => rng2());

  assert.deepEqual(seq1, seq2);
});

test('createSeededRng produces values in [0, 1)', async () => {
  const { createSeededRng } = await import(RNG_MODULE);

  const rng = createSeededRng(12345);

  for (let i = 0; i < 1000; i++) {
    const value = rng();
    assert.ok(value >= 0, `value ${value} should be >= 0`);
    assert.ok(value < 1, `value ${value} should be < 1`);
  }
});

test('createSeededRng different seeds produce different sequences', async () => {
  const { createSeededRng } = await import(RNG_MODULE);

  const rng1 = createSeededRng(1);
  const rng2 = createSeededRng(2);

  const seq1 = Array.from({ length: 5 }, () => rng1());
  const seq2 = Array.from({ length: 5 }, () => rng2());

  assert.notDeepEqual(seq1, seq2);
});

test('createRandomSeed returns a 32-bit integer', async () => {
  const { createRandomSeed } = await import(RNG_MODULE);

  const seed = createRandomSeed();

  assert.ok(Number.isInteger(seed));
  assert.ok(seed >= 0, `seed ${seed} should be >= 0`);
  assert.ok(seed <= 0xFFFFFFFF, `seed ${seed} should be <= 0xFFFFFFFF`);
});

test('runMonteCarloSimulation returns success count and total trials', async () => {
  const { runMonteCarloSimulation } = await import(RNG_MODULE);

  const result = runMonteCarloSimulation(() => true, 1000, 42);

  assert.equal(result.successCount, 1000);
  assert.equal(result.totalTrials, 1000);
  assert.equal(result.isZeroSuccess, false);
});

test('runMonteCarloSimulation with zero successes returns isZeroSuccess=true', async () => {
  const { runMonteCarloSimulation } = await import(RNG_MODULE);

  const result = runMonteCarloSimulation(() => false, 1000, 42);

  assert.equal(result.successCount, 0);
  assert.equal(result.totalTrials, 1000);
  assert.equal(result.isZeroSuccess, true);
});

test('runMonteCarloSimulation is deterministic with same seed', async () => {
  const { createSeededRng, runMonteCarloSimulation } = await import(RNG_MODULE);

  // Simulate a 30% probability trial
  const trialFn = (rng) => rng() < 0.3;

  const result1 = runMonteCarloSimulation(trialFn, 10000, 99);
  const result2 = runMonteCarloSimulation(trialFn, 10000, 99);

  assert.equal(result1.successCount, result2.successCount);
  assert.equal(result1.totalTrials, result2.totalTrials);
});

test('runStrategyMonteCarloSimulation returns finite probability for makers-only random gem target', async () => {
  const { runStrategyMonteCarloSimulation } = await import(RNG_MODULE);

  const strategy = {
    makerChoices: [
      { gemKey: 'blackAmethyst', stats: { weaponAttack: 3 } },
      { gemKey: 'diamond', grade: 2 },
      { gemKey: 'lukCrystal', grade: 2 },
    ],
    scrollSequence: [],
    useItemLevelUp: false,
  };
  const effectiveCleanStats = {
    weaponAttack: 85,
    luk: 5,
  };
  const targetConditions = {
    statThresholds: {
      weaponAttack: 6,
      luk: 5,
    },
    gradeThreshold: null,
  };

  const result = runStrategyMonteCarloSimulation(
    strategy,
    effectiveCleanStats,
    targetConditions,
    100000,
    12345,
  );

  assert.equal(Number.isFinite(result.successProbability), true);
  assert.ok(result.successProbability > 0.035, `expected 흑수정 +3 probability near 5%, got ${result.successProbability}`);
  assert.ok(result.successProbability < 0.065, `expected 흑수정 +3 probability near 5%, got ${result.successProbability}`);
});

test('computeGeometricPercentiles for p=0.5', async () => {
  const { computeGeometricPercentiles } = await import(RNG_MODULE);

  const result = computeGeometricPercentiles(0.5);

  assert.equal(result.p50, 1);
  assert.equal(result.p75, 2);
  assert.equal(result.p90, 4);
  assert.equal(result.p95, 5);
});

test('computeGeometricPercentiles for p=1.0 returns all 1s', async () => {
  const { computeGeometricPercentiles } = await import(RNG_MODULE);

  const result = computeGeometricPercentiles(1.0);

  assert.equal(result.p50, 1);
  assert.equal(result.p75, 1);
  assert.equal(result.p90, 1);
  assert.equal(result.p95, 1);
});

test('computeExpectedAttempts for p=0.5 returns 2', async () => {
  const { computeExpectedAttempts } = await import(RNG_MODULE);

  assert.equal(computeExpectedAttempts(0.5), 2);
});

test('computeExpectedAttempts for p=1.0 returns 1', async () => {
  const { computeExpectedAttempts } = await import(RNG_MODULE);

  assert.equal(computeExpectedAttempts(1.0), 1);
});
