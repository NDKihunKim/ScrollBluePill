import assert from 'node:assert/strict';
import test from 'node:test';
import { computeEnhancementGains, extractTargetConditions, getDefaultCheckedStats } from '../src/lib/expectedValue/targetExtraction.mjs';
import { generateStrategyCandidates } from '../src/lib/expectedValue/candidateGenerator.mjs';
import { isDeterministicStrategy, computeExactProbability } from '../src/lib/expectedValue/exactEngine.mjs';
import { createResultSummary } from '../src/lib/expectedValue/resultFormatter.mjs';
import { optimizeStrategies, countRngSources, countTotalActions } from '../src/lib/expectedValue/strategyOptimizer.mjs';

test('full integration: single 60% scroll meets target', () => {
  const cleanStats = { str: 5, dex: 10, upgradeSlots: 7 };
  const previewStats = { str: 7, dex: 10, upgradeSlots: 7 };

  // 1. Target extraction
  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, { str: 2 });

  const checkedStats = { ...getDefaultCheckedStats(gains), str: true };
  const targetConditions = extractTargetConditions(cleanStats, previewStats, checkedStats, null);
  assert.deepEqual(targetConditions.statThresholds, { str: 2 });

  // 2. Candidate generation
  const scrolls = [
    { id: 's1', nameKo: 'STR 주문서 60%', stats: { str: 2 }, maxApplications: null, behaviorType: 'fixed' },
  ];

  const strategies = generateStrategyCandidates({
    scrolls, checkedStats, upgradeSlots: 7,
    makerAllowed: false, gemSlotCount: 0, equipmentKind: '한손검',
    itemLevelUpAllowed: false, levelUpDefinition: null,
  });

  assert.ok(strategies.length > 0);
  // All strategies should have no maker choices (maker not allowed)
  for (const s of strategies) {
    assert.deepEqual(s.makerChoices, []);
    assert.equal(s.useItemLevelUp, false);
  }

  // 3. Score each strategy — computeExactProbability returns a number directly
  const scored = strategies.map((strategy, i) => {
    const prob = computeExactProbability(strategy, cleanStats, targetConditions);
    return {
      strategy,
      successProbability: prob,
      rngSources: countRngSources(strategy),
      totalActions: countTotalActions(strategy),
      strategyIndex: i,
    };
  });

  // Empty sequence should have probability 0 (no gain)
  assert.equal(scored[0].successProbability, 0);
  // Sequence with at least one scroll should have positive probability
  const nonEmpty = scored.filter(s => s.successProbability > 0);
  assert.ok(nonEmpty.length > 0, 'Some strategies should have positive probability');

  // 4. Optimize
  const best = optimizeStrategies(scored);
  assert.ok(best);
  assert.ok(best.successProbability > 0);
  assert.ok(best.totalActions >= 1);
  assert.equal(best.rngSources, 0); // fixed scroll, no chaos, no maker

  // 5. Format results
  const summary = createResultSummary({
    successProbability: best.successProbability,
    isExact: isDeterministicStrategy(best.strategy),
    trialCount: 0,
    bestStrategy: best.strategy,
  });

  assert.equal(summary.calculationLabel, '정확 계산');
  assert.ok(typeof summary.probabilityLabel === 'string');
  assert.ok(summary.probabilityLabel.includes('%'));
  assert.ok(summary.expectedAttempts >= 1);
  assert.ok(summary.chartData.length > 0);
  assert.equal(summary.bestStrategy, best.strategy);
  assert.ok(summary.percentiles.p50 >= 1);
});

test('full integration: Maker gem + 10% scroll', () => {
  const cleanStats = { str: 5, weaponAttack: 80, upgradeSlots: 7 };
  const previewStats = { str: 11, weaponAttack: 80, upgradeSlots: 7 };

  // 1. Target extraction
  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, { str: 6 });

  const checkedStats = { ...getDefaultCheckedStats(gains), str: true };
  const targetConditions = extractTargetConditions(cleanStats, previewStats, checkedStats, null);
  assert.deepEqual(targetConditions.statThresholds, { str: 6 });

  // 2. Candidate generation with maker
  const scrolls = [
    { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null, behaviorType: 'fixed' },
  ];

  const strategies = generateStrategyCandidates({
    scrolls, checkedStats, upgradeSlots: 7,
    makerAllowed: true, gemSlotCount: 1, equipmentKind: '한손검',
    itemLevelUpAllowed: false, levelUpDefinition: null,
  });

  // Should have strategies with both maker choices and scrolls
  const withMaker = strategies.filter(s => s.makerChoices.length > 0 && s.scrollSequence.length > 0);
  assert.ok(withMaker.length > 0, 'Should have strategies with both maker and scrolls');

  // 3. Score strategies that have maker choices
  // computeExactProbability returns a number directly
  const scored = withMaker.map((strategy, i) => {
    const prob = computeExactProbability(strategy, cleanStats, targetConditions);
    return {
      strategy,
      successProbability: prob,
      rngSources: countRngSources(strategy),
      totalActions: countTotalActions(strategy),
      strategyIndex: i,
    };
  });

  // 4. Optimize
  const viable = scored.filter(s => s.successProbability > 0);
  assert.ok(viable.length > 0, 'Should have viable maker strategies');

  const best = optimizeStrategies(viable);
  assert.ok(best, 'Should find viable strategy');

  // 5. Format results
  const summary = createResultSummary({
    successProbability: best.successProbability,
    isExact: true,
    trialCount: 0,
    bestStrategy: best.strategy,
  });

  assert.ok(summary.expectedAttempts >= 1);
  assert.ok(summary.probabilityLabel.length > 0);
  assert.ok(summary.chartData.length > 0);
  assert.equal(summary.isExact, true);
});

test('full integration: empty enhancement (100% success)', () => {
  const cleanStats = { str: 10 };
  const previewStats = { str: 10 };

  // No gains → no target conditions
  const targetConditions = extractTargetConditions(cleanStats, previewStats, {}, null);
  assert.deepEqual(targetConditions.statThresholds, {});

  // No scrolls, no maker
  const strategies = generateStrategyCandidates({
    scrolls: [], checkedStats: {}, upgradeSlots: 7,
    makerAllowed: false, gemSlotCount: 0, equipmentKind: '한손검',
    itemLevelUpAllowed: false, levelUpDefinition: null,
  });

  // Only empty strategy
  assert.equal(strategies.length, 1);
  const strategy = strategies[0];
  assert.deepEqual(strategy.makerChoices, []);
  assert.deepEqual(strategy.scrollSequence, []);
  assert.equal(strategy.useItemLevelUp, false);

  // Probability should be 1.0 (no target = always satisfied)
  // computeExactProbability returns a number directly
  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 1.0);

  // Format results
  const summary = createResultSummary({
    successProbability: prob,
    isExact: isDeterministicStrategy(strategy),
    trialCount: 0,
    bestStrategy: strategy,
  });

  assert.equal(summary.probabilityLabel, '100.00%');
  assert.equal(summary.expectedAttempts, 1);
  assert.equal(summary.calculationLabel, '정확 계산');
  assert.equal(summary.isExact, true);
  assert.ok(summary.chartData.length > 0);
  // For p=1.0, all percentiles map to 1 attempt (except 0% → 0)
  assert.equal(summary.chartData[50].attempts, 1);
  assert.equal(summary.chartData[50].percentile, 50);
});

test('full integration: chaos scroll is detected as RNG source', () => {
  const cleanStats = { str: 5, dex: 15, upgradeSlots: 7 };
  const previewStats = { str: 5, dex: 15, upgradeSlots: 7 };

  // No target threshold (clean = preview, no gains)
  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, {});

  const checkedStats = { ...getDefaultCheckedStats(gains), dex: true };
  // Chaos scroll with stats — dex is checked so the scroll survives pruneUselessScrolls
  const scrolls = [
    { id: 's1', nameKo: '혼돈의 주문서 60%', stats: { dex: 1 }, maxApplications: null, behavior_type: 'chaos' },
  ];

  const strategies = generateStrategyCandidates({
    scrolls, checkedStats, upgradeSlots: 7,
    makerAllowed: false, gemSlotCount: 0, equipmentKind: '한손검',
    itemLevelUpAllowed: false, levelUpDefinition: null,
  });

  // Strategy with chaos scroll
  const withChaos = strategies.filter(s => s.scrollSequence.length > 0);
  assert.ok(withChaos.length > 0);

  // isDeterministicStrategy should be false for chaos
  assert.equal(isDeterministicStrategy(withChaos[0]), false);

  // countRngSources should include chaos scrolls
  for (const s of withChaos) {
    assert.ok(countRngSources(s) >= 1);
  }

  // Non-chaos strategies
  for (const s of strategies) {
    if (s.scrollSequence.length === 0) {
      assert.equal(isDeterministicStrategy(s), true);
      assert.equal(countRngSources(s), 0);
    }
  }
});
