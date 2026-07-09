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
  computeCountForTopPercent,
  computeTopPercentForCount,
  createResultMutationGuard,
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
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

  assert.match(panelSource, /ev-target-chip-grid/);
  assert.match(panelSource, /ev-target-chip/);
  assert.match(panelSource, /ev-target-chip-label/);
  assert.match(panelSource, /if \(!gain \|\| gain <= 0\) \{\s*continue;\s*\}/);
  assert.match(indexSource, /:global\(\.ev-target-chip-grid\)\s*\{/);
  assert.match(indexSource, /grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\);/);
  assert.match(indexSource, /:global\(\.ev-target-chip input:checked \+ \.ev-target-chip-label\)/);
});

test('confirmation dialog uses global fixed overlay styles for dynamic body append', async () => {
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

  assert.match(panelSource, /CONFIRM_TEXT/);
  assert.match(indexSource, /overlay\.className = 'ev-confirm-overlay'/);
  assert.match(indexSource, /:global\(\.ev-confirm-overlay\)\s*\{[^}]*position:\s*fixed;/);
  assert.match(indexSource, /:global\(\.ev-confirm-dialog\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-confirm-buttons\)\s*\{/);
  assert.doesNotMatch(indexSource, /(?:^|\n)\s*\.ev-confirm-overlay\s*\{/);
});

test('result chart uses global bounded canvas styles for dynamic rendering', async () => {
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

  assert.match(panelSource, /canvas\.className = 'ev-chart'/);
  assert.match(indexSource, /:global\(\.ev-chart\)\s*\{[^}]*display:\s*block;/);
  assert.match(indexSource, /:global\(\.ev-chart\)\s*\{[^}]*width:\s*100%;/);
  assert.match(indexSource, /:global\(\.ev-chart\)\s*\{[^}]*max-width:\s*100%;/);
  assert.match(indexSource, /:global\(\.ev-chart\)\s*\{[^}]*height:\s*220px;/);
  assert.doesNotMatch(indexSource, /(?:^|\n)\s*\.ev-chart\s*\{/);
});

test('expected value strategy preserves variable maker gem stats from UI state', async () => {
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

  assert.match(indexSource, /s\.stats\s*\?/);
  assert.match(indexSource, /stats:\s*s\.stats/);
  assert.match(indexSource, /grade:\s*s\.gradeIndex/);
});

test('expected value strategy separates manual material stats from probability material sources', async () => {
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

  assert.match(indexSource, /MATERIAL_MODE_PROBABILITY/);
  assert.match(indexSource, /s\.mode\s*===\s*MATERIAL_MODE_PROBABILITY/);
  assert.match(indexSource, /preApply\(enhancementState\.stimulantSlot\.stats\)/);
  assert.doesNotMatch(indexSource, /preApply\(s\.stats\)/);
  assert.match(indexSource, /useStimulant:\s*enhancementState\.stimulantSlot\?\.mode\s*===\s*MATERIAL_MODE_PROBABILITY/);
});

test('result panel renders interactive attempt row with input and cumulative probability', async () => {
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

  assert.match(panelSource, /ev-result-title/);
  assert.match(panelSource, /제작 시도 횟수 기대값/);
  assert.doesNotMatch(panelSource, /평균 장비 기대값/);
  assert.match(panelSource, /ev-equipment-count/);
  assert.match(panelSource, /ev-converter-row/);
  assert.match(panelSource, /ev-percent-input/);
  assert.match(panelSource, /ev-count-input/);
  assert.match(panelSource, /상위/);
  assert.match(panelSource, /countPrefix\.textContent = '시도 횟수:'/);
  assert.match(panelSource, /countSuffix\.textContent = '회'/);
  assert.match(panelSource, /computeCumulativeProbability/);
  assert.match(panelSource, /computeAttemptsForPercentile/);
  assert.match(panelSource, /updatePercentFromCount/);
  assert.match(panelSource, /updateCountFromPercent/);
  assert.match(panelSource, /percentInput\.addEventListener\('input',\s*updateCountFromPercent\)/);
  assert.match(panelSource, /countInput\.addEventListener\('input',\s*updatePercentFromCount\)/);
  assert.doesNotMatch(panelSource, /제작 횟수/);
  assert.match(panelSource, /formatPercentInputValue\(cumulative\)/);
  assert.match(indexSource, /:global\(\.ev-result-title\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-equipment-count\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-converter-row\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-converter-field\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-percent-input\)\s*\{/);
  assert.match(indexSource, /:global\(\.ev-count-input\)\s*\{/);
  assert.doesNotMatch(panelSource, /ev-percentiles/);
  assert.doesNotMatch(panelSource, /ev-expected-attempts/);
  assert.doesNotMatch(panelSource, /ev-method-label/);
  assert.doesNotMatch(panelSource, /ev-probability/);
});

test('calculator panel headings share the reduced title treatment', async () => {
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

  assert.match(
    indexSource,
    /\.panel > h2\s*\{[^}]*color:\s*var\(--ink\);[^}]*font-size:\s*clamp\(1\.05rem,\s*1\.5vw,\s*1\.35rem\);/s,
  );
  assert.match(
    indexSource,
    /\.calculator-panel\.result-panel h3\s*\{[^}]*color:\s*var\(--ink\);[^}]*font-size:\s*clamp\(1\.05rem,\s*1\.5vw,\s*1\.35rem\);/s,
  );
});

test('result panel converter maps count and percentile consistently', () => {
  const successProbability = 1 / 3125;
  const defaultTopPercent = computeTopPercentForCount(successProbability, 3125);

  assert.equal(defaultTopPercent, '63.22');
  assert.equal(
    computeCountForTopPercent(successProbability, Number(defaultTopPercent)),
    3126,
  );
  assert.equal(
    computeCountForTopPercent(successProbability, Number(defaultTopPercent), 3125),
    3125,
  );
  assert.equal(computeTopPercentForCount(successProbability, 1), '0.03');
  assert.equal(computeCountForTopPercent(successProbability, 0), 0);
});

test('EV clear hook is exposed for reset handler', async () => {
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');

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

test('result mutation guard runs immediately without results and clears before confirmed mutations', () => {
  assert.equal(typeof createResultMutationGuard, 'function');

  const immediateEvents = [];
  const runImmediate = createResultMutationGuard({
    hasResult: () => false,
    clearResult: () => immediateEvents.push('clear'),
    requestConfirmation: () => immediateEvents.push('confirm'),
  });
  runImmediate(() => immediateEvents.push('mutate'));
  assert.deepEqual(immediateEvents, ['mutate']);

  const guardedEvents = [];
  let confirmMutation = null;
  const runGuarded = createResultMutationGuard({
    hasResult: () => true,
    clearResult: () => guardedEvents.push('clear'),
    requestConfirmation: (onConfirm) => {
      guardedEvents.push('confirm');
      confirmMutation = onConfirm;
    },
  });
  runGuarded(() => guardedEvents.push('mutate'));
  assert.deepEqual(guardedEvents, ['confirm']);

  confirmMutation();
  assert.deepEqual(guardedEvents, ['confirm', 'clear', 'mutate']);
});

test('completed results expose one confirmation guard to every enhancement subsystem', async () => {
  const indexSource = await readFile(new URL('../src/pages/expected-value.astro', import.meta.url), 'utf8');
  const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');
  const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');
  const itemLevelUpPanelSource = await readFile(new URL('../src/lib/itemLevelUpPanel.mjs', import.meta.url), 'utf8');

  assert.match(indexSource, /계산 결과가 초기화됩니다\. 계속하시겠습니까\?/);
  assert.match(indexSource, /window\.__evGuardEnhancementMutation\s*=\s*createResultMutationGuard/);
  assert.match(enhancementPanelSource, /requestEnhancementMutation/);
  assert.match(enhancementPanelSource, /requestMutation:\s*requestEnhancementMutation/);
  assert.match(makerPanelSource, /requestMutation/);
  assert.match(itemLevelUpPanelSource, /requestMutation/);

  for (const mutation of ['clearSlot', 'applyScroll']) {
    assert.match(enhancementPanelSource, new RegExp(`requestEnhancementMutation\\(\\(\\) => \\{[\\s\\S]*?${mutation}`));
  }
  for (const mutation of ['applyVariableGem', 'applyStimulant', 'clearStimulant', 'revertGemSlot', 'applyGem']) {
    assert.match(makerPanelSource, new RegExp(`requestMutation\\(\\(\\) => \\{[\\s\\S]*?${mutation}`));
  }
  for (const mutation of ['clearItemLevelUpSlot', 'applyItemLevelUp', 'applyItemLevelUpMode']) {
    assert.match(itemLevelUpPanelSource, new RegExp(`requestMutation\\(\\(\\) => \\{[\\s\\S]*?${mutation}`));
  }
});
