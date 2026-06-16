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

test('target selection renders compact chips and skips zero-gain stats', async () => {
  const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.match(panelSource, /ev-target-chip-grid/);
  assert.match(panelSource, /ev-target-chip/);
  assert.match(panelSource, /ev-target-chip-label/);
  assert.match(panelSource, /if \(!gain \|\| gain <= 0\) \{\s*continue;\s*\}/);
  assert.match(indexSource, /:global\(\.ev-target-chip-grid\)\s*\{/);
  assert.match(indexSource, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(indexSource, /:global\(\.ev-target-chip input:checked \+ \.ev-target-chip-label\)/);
});

test('confirmation dialog uses global fixed overlay styles for dynamic body append', async () => {
  const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.match(panelSource, /CONFIRM_TEXT/);
  assert.match(indexSource, /overlay\.className = 'ev-confirm-overlay'/);
  assert.match(indexSource, /:global\(\.ev-confirm-overlay\)\s*\{[^}]*position:\s*fixed;/);
  assert.match(indexSource, /:global\(\.ev-confirm-dialog\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-confirm-buttons\)\s*\{/);
  assert.doesNotMatch(indexSource, /(?:^|\n)\s*\.ev-confirm-overlay\s*\{/);
});

test('result chart uses global bounded canvas styles for dynamic rendering', async () => {
  const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.match(panelSource, /canvas\.className = 'ev-chart'/);
  assert.match(indexSource, /:global\(\.ev-chart\)\s*\{[^}]*display:\s*block;/);
  assert.match(indexSource, /:global\(\.ev-chart\)\s*\{[^}]*width:\s*100%;/);
  assert.match(indexSource, /:global\(\.ev-chart\)\s*\{[^}]*max-width:\s*100%;/);
  assert.match(indexSource, /:global\(\.ev-chart\)\s*\{[^}]*height:\s*220px;/);
  assert.doesNotMatch(indexSource, /(?:^|\n)\s*\.ev-chart\s*\{/);
});

test('expected value strategy preserves variable maker gem stats from UI state', async () => {
  const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.match(indexSource, /s\.stats\s*\?/);
  assert.match(indexSource, /stats:\s*s\.stats/);
  assert.match(indexSource, /grade:\s*s\.gradeIndex/);
});

test('MIN_TRIALS=1000, MAX_TRIALS=10000000, DEFAULT_TRIAL_COUNT=100000', async () => {
  assert.equal(MIN_TRIALS, 1000);
  assert.equal(MAX_TRIALS, 10000000);

  const { DEFAULT_TRIAL_COUNT } = await import('../src/lib/expectedValue/monteCarloEngine.mjs');
  assert.equal(DEFAULT_TRIAL_COUNT, 100000);
});

test('roundTrialCount rounds to nearest TRIAL_STEP (10000) and clamps', () => {
  assert.equal(roundTrialCount(0), 1000);
  assert.equal(roundTrialCount(5000), 10000);
  assert.equal(roundTrialCount(15000), 20000);
  assert.equal(roundTrialCount(50000), 50000);
  assert.equal(roundTrialCount(55000), 60000);
});

test('roundTrialCount clamps to MIN', () => {
  assert.equal(roundTrialCount(-100), 1000);
  assert.equal(roundTrialCount(0), 1000);
  assert.equal(roundTrialCount(1), 1000);
  assert.equal(roundTrialCount(999), 1000);
});

test('roundTrialCount clamps to MAX', () => {
  assert.equal(roundTrialCount(10000001), 10000000);
  assert.equal(roundTrialCount(20000000), 10000000);
  assert.equal(roundTrialCount(9999999), 10000000);
});

test('result panel renders interactive attempt row with input and cumulative probability', async () => {
  const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.match(panelSource, /ev-result-title/);
  assert.match(panelSource, /평균 장비 기대값/);
  assert.match(panelSource, /ev-equipment-count/);
  assert.match(panelSource, /장비 갯수/);
  assert.match(panelSource, /ev-attempt-row/);
  assert.match(panelSource, /ev-attempt-input/);
  assert.match(panelSource, /ev-attempt-result/);
  assert.match(panelSource, /computeCumulativeProbability/);
  assert.match(panelSource, /updateAttemptResult/);
  assert.match(panelSource, /attemptInput\.addEventListener\('input',\s*updateAttemptResult\)/);
  assert.match(panelSource, /시도 횟수/);
  assert.match(panelSource, /formatProbability\(cumulative\)/);
  assert.match(indexSource, /:global\(\.ev-result-title\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-equipment-count\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-attempt-row\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-attempt-input\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-attempt-result\)\s*\{/);
  assert.doesNotMatch(panelSource, /ev-percentiles/);
  assert.doesNotMatch(panelSource, /ev-expected-attempts/);
  assert.doesNotMatch(panelSource, /ev-method-label/);
  assert.doesNotMatch(panelSource, /ev-probability/);
});

test('EV clear hook is exposed for reset handler', async () => {
  const indexSource = await readFile(new URL('../src/pages/index.astro', import.meta.url), 'utf8');

  assert.match(indexSource, /window\.__evClear\s*=\s*showEvPlaceholder/);
});

test('enhancement reset shows confirmation dialog and calls __evClear on confirm', async () => {
  const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

  assert.match(enhancementPanelSource, /모든 강화 설정과 계산 결과가 초기화됩니다/);
  assert.match(enhancementPanelSource, /ev-confirm-overlay/);
  assert.match(enhancementPanelSource, /ev-confirm-dialog/);
  assert.match(enhancementPanelSource, /ev-confirm-buttons/);
  assert.match(enhancementPanelSource, /window\.__evClear/);
});
