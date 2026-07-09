import assert from 'node:assert/strict';
import test from 'node:test';

const GEOM_MODULE = '../src/lib/expectedValue/monteCarloEngine.mjs';

// ---------------------------------------------------------------------------
// Geometric distribution math (kept from the former Monte Carlo module)
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

// ---------------------------------------------------------------------------
// Unified exact engine: formerly-MC-only strategies now computed exactly
// ---------------------------------------------------------------------------

const EXACT_MODULE = '../src/lib/expectedValue/exactEngine.mjs';

test('exact engine: manual variable gem stats applied to baseline', async () => {
  const { computeExactProbability } = await import(EXACT_MODULE);

  const prob = computeExactProbability(
    {
      makerChoices: [{ gemKey: 'darkCrystal', stats: { str: 3 }, mode: 'manual' }],
      scrollSequence: [],
      useItemLevelUp: false,
      useStimulant: false,
    },
    { str: 10 },
    { statThresholds: { str: 3 } },
  );

  assert.equal(prob, 1);
});

test('exact engine: missing-mode variable gem stats applied as manual', async () => {
  const { computeExactProbability } = await import(EXACT_MODULE);

  const prob = computeExactProbability(
    {
      makerChoices: [{ gemKey: 'darkCrystal', stats: { str: 3 } }],
      scrollSequence: [],
      useItemLevelUp: false,
      useStimulant: false,
    },
    { str: 10 },
    { statThresholds: { str: 3 } },
  );

  assert.equal(prob, 1);
});

test('exact engine: probability-mode random gems are stochastic (not pre-applied)', async () => {
  const { computeExactProbability } = await import(EXACT_MODULE);

  // Asking for an impossible stat gain via random gem → probability should be 0
  const prob = computeExactProbability(
    {
      makerChoices: [{ gemKey: 'darkCrystal', stats: { str: 5 }, mode: 'probability' }],
      scrollSequence: [],
      useItemLevelUp: false,
      useStimulant: false,
    },
    { str: 10 },
    { statThresholds: { str: 99 } },
  );

  assert.equal(prob, 0);
});

test('exact engine: chaos scroll produces valid probability', async () => {
  const { computeExactProbability } = await import(EXACT_MODULE);

  // A single chaos scroll on a weapon: 60% success rate, each stat gets -5..+5 delta
  const prob = computeExactProbability(
    {
      makerChoices: [],
      scrollSequence: [{ nameKo: '혼돈의 주문서 60%', behavior_type: 'chaos' }],
      useItemLevelUp: false,
      useStimulant: false,
    },
    { weaponAttack: 80, str: 10, dex: 5 },
    { statThresholds: { weaponAttack: 1 } }, // need +1 atk gain
  );

  // Exact probability should be > 0 and < 1
  assert.ok(prob > 0, `Expected positive probability, got ${prob}`);
  assert.ok(prob < 1, `Expected probability < 1, got ${prob}`);
  // The chaos scroll has 60% success; on success, positive weaponAttack delta is ~48% likely.
  // So overall success probability from exact DP ≈ 0.6 * 0.48 ≈ 0.29
  assert.ok(prob > 0.2 && prob < 0.4, `Expected chaos +1atk prob ~0.29, got ${prob}`);
});

test('exact engine: stimulant produces valid probability', async () => {
  const { computeExactProbability } = await import(EXACT_MODULE);

  const prob = computeExactProbability(
    {
      makerChoices: [],
      scrollSequence: [],
      useItemLevelUp: false,
      useStimulant: true,
    },
    { weaponAttack: 80, str: 10 },
    { statThresholds: { weaponAttack: 1 } },
  );

  // Stimulant: 90% success, on success 0..+5 delta. Need at least +1.
  // P(success) * P(delta >= 1) = 0.9 * (1 - 0.202) = 0.9 * 0.798 ≈ 0.7182
  assert.ok(prob > 0, `Expected positive probability, got ${prob}`);
  assert.ok(prob < 1, `Expected probability < 1, got ${prob}`);
  // Allow ~0.01 tolerance
  assert.ok(Math.abs(prob - 0.7182) < 0.02, `Expected stimulant prob ~0.718, got ${prob}`);
});

test('exact engine: isDeterministicStrategy correctly identifies randomness', async () => {
  const { isDeterministicStrategy } = await import(EXACT_MODULE);

  // All deterministic
  assert.equal(isDeterministicStrategy({
    makerChoices: [{ gemKey: 'diamond', grade: 2 }],
    scrollSequence: [{ nameKo: '60% scroll', behavior_type: 'fixed' }],
    useItemLevelUp: false,
    useStimulant: false,
  }), true);

  // Chaos scroll makes it non-deterministic
  assert.equal(isDeterministicStrategy({
    makerChoices: [],
    scrollSequence: [{ behavior_type: 'chaos' }],
    useItemLevelUp: false,
    useStimulant: false,
  }), false);

  // Stimulant makes it non-deterministic
  assert.equal(isDeterministicStrategy({
    makerChoices: [],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: true,
  }), false);

  // Random gem makes it non-deterministic
  assert.equal(isDeterministicStrategy({
    makerChoices: [{ gemKey: 'blackAmethyst', grade: 1 }],
    scrollSequence: [],
    useItemLevelUp: false,
    useStimulant: false,
  }), false);
});
