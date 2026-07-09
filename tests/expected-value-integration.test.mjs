import assert from 'node:assert/strict';
import test from 'node:test';
import { computeEnhancementGains, extractTargetConditions, getDefaultCheckedStats } from '../src/lib/expectedValue/targetExtraction.mjs';
import { generateStrategyCandidates } from '../src/lib/expectedValue/candidateGenerator.mjs';
import { computeExactProbability } from '../src/lib/expectedValue/exactEngine.mjs';
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
  for (const s of strategies) {
    assert.deepEqual(s.makerChoices, []);
    assert.equal(s.useItemLevelUp, false);
  }

  // 3. Score each strategy — unified exact engine handles all strategy types
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

  assert.equal(scored[0].successProbability, 0);
  const nonEmpty = scored.filter(s => s.successProbability > 0);
  assert.ok(nonEmpty.length > 0, 'Some strategies should have positive probability');

  // 4. Optimize
  const best = optimizeStrategies(scored);
  assert.ok(best);
  assert.ok(best.successProbability > 0);
  assert.ok(best.totalActions >= 1);

  // 5. Format results
  const summary = createResultSummary({
    successProbability: best.successProbability,
    bestStrategy: best.strategy,
  });

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

  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, { str: 6 });

  const checkedStats = { ...getDefaultCheckedStats(gains), str: true };
  const targetConditions = extractTargetConditions(cleanStats, previewStats, checkedStats, null);
  assert.deepEqual(targetConditions.statThresholds, { str: 6 });

  const scrolls = [
    { id: 's1', nameKo: 'STR 주문서 10%', stats: { str: 3 }, maxApplications: null, behaviorType: 'fixed' },
  ];

  const strategies = generateStrategyCandidates({
    scrolls, checkedStats, upgradeSlots: 7,
    makerAllowed: true, gemSlotCount: 1, equipmentKind: '한손검',
    itemLevelUpAllowed: false, levelUpDefinition: null,
  });

  const withMaker = strategies.filter(s => s.makerChoices.length > 0 && s.scrollSequence.length > 0);
  assert.ok(withMaker.length > 0, 'Should have strategies with both maker and scrolls');

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

  const viable = scored.filter(s => s.successProbability > 0);
  assert.ok(viable.length > 0, 'Should have viable maker strategies');

  const best = optimizeStrategies(viable);
  assert.ok(best, 'Should find viable strategy');

  const summary = createResultSummary({
    successProbability: best.successProbability,
    bestStrategy: best.strategy,
  });

  assert.ok(summary.expectedAttempts >= 1);
  assert.ok(summary.probabilityLabel.length > 0);
  assert.ok(summary.chartData.length > 0);
});

test('full integration: empty enhancement (100% success)', () => {
  const cleanStats = { str: 10 };
  const previewStats = { str: 10 };

  const targetConditions = extractTargetConditions(cleanStats, previewStats, {}, null);
  assert.deepEqual(targetConditions.statThresholds, {});

  const strategies = generateStrategyCandidates({
    scrolls: [], checkedStats: {}, upgradeSlots: 7,
    makerAllowed: false, gemSlotCount: 0, equipmentKind: '한손검',
    itemLevelUpAllowed: false, levelUpDefinition: null,
  });

  assert.equal(strategies.length, 1);
  const strategy = strategies[0];
  assert.deepEqual(strategy.makerChoices, []);
  assert.deepEqual(strategy.scrollSequence, []);
  assert.equal(strategy.useItemLevelUp, false);

  const prob = computeExactProbability(strategy, cleanStats, targetConditions);
  assert.equal(prob, 1.0);

  const summary = createResultSummary({
    successProbability: prob,
    bestStrategy: strategy,
  });

  assert.equal(summary.probabilityLabel, '100.00%');
  assert.equal(summary.expectedAttempts, 1);
  assert.ok(summary.chartData.length > 0);
  assert.equal(summary.chartData[50].attempts, 1);
  assert.equal(summary.chartData[50].percentile, 50);
});

test('full integration: chaos scroll now uses exact engine', () => {
  const cleanStats = { str: 5, dex: 15, upgradeSlots: 7 };
  const previewStats = { str: 5, dex: 15, upgradeSlots: 7 };

  const gains = computeEnhancementGains(cleanStats, previewStats);
  assert.deepEqual(gains, {});

  const checkedStats = { ...getDefaultCheckedStats(gains), dex: true };

  const scrolls = [
    { id: 's1', nameKo: '혼돈의 주문서 60%', stats: { dex: 1 }, maxApplications: null, behavior_type: 'chaos' },
  ];

  const strategies = generateStrategyCandidates({
    scrolls, checkedStats, upgradeSlots: 7,
    makerAllowed: false, gemSlotCount: 0, equipmentKind: '한손검',
    itemLevelUpAllowed: false, levelUpDefinition: null,
  });

  const withChaos = strategies.filter(s => s.scrollSequence.length > 0);
  assert.ok(withChaos.length > 0);

  // Chaos strategies now work with the unified exact engine — computeExactProbability
  // handles chaos via probability distribution transitions, not Monte Carlo
  for (const s of withChaos) {
    const prob = computeExactProbability(s, cleanStats, { statThresholds: {} });
    assert.ok(Number.isFinite(prob) && prob >= 0 && prob <= 1,
      'Chaos scroll should produce a valid probability from the unified exact engine');
  }

  // countRngSources still reports chaos as RNG sources (for informational ranking)
  for (const s of withChaos) {
    assert.ok(countRngSources(s) >= 1);
  }
});
