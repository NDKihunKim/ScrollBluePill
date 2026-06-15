import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const panelSource = await readFile(
  new URL('../src/lib/expectedValue/expectedValuePanel.mjs', import.meta.url),
  'utf8',
);

const {
  PLACEHOLDER_TEXT,
  NO_STRATEGY_TEXT,
  STALE_LABEL,
  CONFIRM_TEXT,
  CONFIRM_BUTTON_TEXT,
  CANCEL_BUTTON_TEXT,
  MIN_TRIALS,
  MAX_TRIALS,
  TRIAL_STEP,
  roundTrialCount,
} = await import('../src/lib/expectedValue/expectedValuePanel.mjs');

test('PLACEHOLDER_TEXT is defined and non-empty', () => {
  assert.ok(typeof PLACEHOLDER_TEXT === 'string');
  assert.ok(PLACEHOLDER_TEXT.length > 0);
});

test('NO_STRATEGY_TEXT is defined', () => {
  assert.ok(typeof NO_STRATEGY_TEXT === 'string');
  assert.ok(NO_STRATEGY_TEXT.length > 0);
});

test('STALE_LABEL is defined', () => {
  assert.ok(typeof STALE_LABEL === 'string');
  assert.ok(STALE_LABEL.length > 0);
});

test('CONFIRM_TEXT, CONFIRM_BUTTON_TEXT, CANCEL_BUTTON_TEXT are defined', () => {
  assert.ok(typeof CONFIRM_TEXT === 'string');
  assert.ok(CONFIRM_TEXT.length > 0);
  assert.ok(typeof CONFIRM_BUTTON_TEXT === 'string');
  assert.ok(CONFIRM_BUTTON_TEXT.length > 0);
  assert.ok(typeof CANCEL_BUTTON_TEXT === 'string');
  assert.ok(CANCEL_BUTTON_TEXT.length > 0);
});

test('button labels exist in source', () => {
  assert.match(panelSource, /기대값 계산/);
  assert.match(panelSource, /계산 시작/);
  assert.match(panelSource, /계산 취소/);
});

test('MIN_TRIALS=1000, MAX_TRIALS=1000000, DEFAULT_TRIAL_COUNT=100000', async () => {
  assert.equal(MIN_TRIALS, 1000);
  assert.equal(MAX_TRIALS, 1000000);

  const { DEFAULT_TRIAL_COUNT } = await import('../src/lib/expectedValue/monteCarloEngine.mjs');
  assert.equal(DEFAULT_TRIAL_COUNT, 100000);
});

test('roundTrialCount rounds to nearest 1000 and clamps', () => {
  assert.equal(roundTrialCount(0), 1000);
  assert.equal(roundTrialCount(500), 1000);
  assert.equal(roundTrialCount(1500), 2000);
  assert.equal(roundTrialCount(50000), 50000);
  assert.equal(roundTrialCount(50500), 51000);
});

test('roundTrialCount clamps to MIN', () => {
  assert.equal(roundTrialCount(-100), 1000);
  assert.equal(roundTrialCount(0), 1000);
  assert.equal(roundTrialCount(1), 1000);
  assert.equal(roundTrialCount(999), 1000);
});

test('roundTrialCount clamps to MAX', () => {
  assert.equal(roundTrialCount(1000001), 1000000);
  assert.equal(roundTrialCount(2000000), 1000000);
  assert.equal(roundTrialCount(999999), 1000000);
});
