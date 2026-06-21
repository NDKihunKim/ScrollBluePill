import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageSource = await readFile(
  new URL('../src/pages/deconstruction.astro', import.meta.url),
  'utf8',
);

test('successful-scroll editor appears before the remaining-slot editor with every control hook', () => {
  const successRowIndex = pageSource.indexOf('data-decon-success-row');
  const remainingRowIndex = pageSource.indexOf('class="chaos-stat-row decon-slot-row"');

  assert.ok(successRowIndex >= 0, 'missing successful-scroll row');
  assert.ok(remainingRowIndex > successRowIndex, 'successful-scroll row must precede remaining slots');

  const successRow = pageSource.slice(successRowIndex, remainingRowIndex);
  assert.match(successRow, /주문서 성공 횟수/);
  for (const hook of ['min', 'dec', 'value', 'inc', 'max']) {
    assert.match(successRow, new RegExp(`data-decon-success-${hook}`));
  }
  assert.match(successRow, /data-decon-success-value>0</);
});

test('successful-scroll and remaining-slot rows share vertical spacing', () => {
  assert.match(
    pageSource,
    /\.decon-success-row,\s*\.decon-slot-row\s*\{\s*margin-bottom:\s*10px;\s*\}/,
  );
});

test('page uses the coupled slot-state model for both editors and selected-item resets', () => {
  assert.match(
    pageSource,
    /import \{\s*createDeconstructionSlotState,\s*setSuccessfulScrollCount,\s*setRemainingSlotCount,?\s*\} from '\.\.\/lib\/deconstruction\/slotState\.mjs';/,
  );
  assert.match(pageSource, /let deconSlotState = createDeconstructionSlotState\(0\);/);
  assert.match(
    pageSource,
    /deconSlotState = createDeconstructionSlotState\(item\.stats\?\.upgradeSlots \?\? 0\);/,
  );
  assert.match(pageSource, /setSuccessfulScrollCount\(deconSlotState, 0\)/);
  assert.match(pageSource, /setSuccessfulScrollCount\(deconSlotState, deconSlotState\.successfulScrollCount - 1\)/);
  assert.match(pageSource, /setSuccessfulScrollCount\(deconSlotState, deconSlotState\.successfulScrollCount \+ 1\)/);
  assert.match(pageSource, /setSuccessfulScrollCount\(deconSlotState, deconSlotState\.maxSlots\)/);
  assert.match(pageSource, /setRemainingSlotCount\(deconSlotState, 0\)/);
  assert.match(pageSource, /setRemainingSlotCount\(deconSlotState, deconSlotState\.remainingSlots - 1\)/);
  assert.match(pageSource, /setRemainingSlotCount\(deconSlotState, deconSlotState\.remainingSlots \+ 1\)/);
  assert.match(pageSource, /setRemainingSlotCount\(deconSlotState, deconSlotState\.maxSlots\)/);
  assert.doesNotMatch(pageSource, /\bdecon(?:Available|Max)Slots\b/);
});

test('one slot render updates both values and refreshes the item card', () => {
  assert.match(
    pageSource,
    /const renderDeconSlotState = \(\) => \{[\s\S]*deconSuccessValue\.textContent = String\(deconSlotState\.successfulScrollCount\);[\s\S]*deconSlotValue\.textContent = String\(deconSlotState\.remainingSlots\);[\s\S]*updateTargetCard\(\);[\s\S]*\};/,
  );
});

test('item card shows a success-count suffix only above zero and renders remaining slots', () => {
  assert.match(
    pageSource,
    /selectedItemName\.textContent = `\$\{item\.nameKo\}\$\{deconSlotState\.successfulScrollCount > 0 \? ` \(\+\$\{deconSlotState\.successfulScrollCount\}\)` : ''\}`;/,
  );
  assert.match(pageSource, /createItemLine\(label, deconSlotState\.remainingSlots\)/);
  assert.match(pageSource, /selectedItemName\.style\.color = computeDeconGrade\(\);/);
});

test('analysis passes the exact successful-scroll count and source permissions to the engine', () => {
  const runAnalysisStart = pageSource.indexOf('const runAnalysis = () => {');
  const displayResultsStart = pageSource.indexOf('// ---- Display results ----', runAnalysisStart);
  assert.ok(runAnalysisStart >= 0 && displayResultsStart > runAnalysisStart);
  const runAnalysisSource = pageSource.slice(runAnalysisStart, displayResultsStart);

  assert.match(
    runAnalysisSource,
    /enumerateStrategies\(\{[\s\S]*successfulScrollCount: deconSlotState\.successfulScrollCount,[\s\S]*equipmentKind,[\s\S]*allowedSources: getAllowedSources\(\),[\s\S]*scrollsByEquipmentKind,[\s\S]*\}\)/,
  );
  assert.doesNotMatch(runAnalysisSource, /\bupgradeSlots\b/);
});

test('page loads item-level data and passes complete exact-search inputs', () => {
  assert.match(pageSource, /item-level-ups-gms83-ko\.json/);
  assert.match(pageSource, /itemLevelUpByItemId/);
  assert.match(pageSource, /targetKeys:\s*checkedKeys/);
  assert.match(pageSource, /requiredLevel:\s*selectedItem\.requiredLevel/);
  assert.match(pageSource, /cleanStats:\s*selectedItem\.stats/);
  assert.match(pageSource, /levelUpDefinition:\s*itemLevelUpByItemId\.get\(selectedItem\.id\) \?\? null/);
});

test('deconstruction results contain source details without probability', () => {
  assert.doesNotMatch(pageSource, /strategy\.probability/);
  assert.doesNotMatch(pageSource, /decon-strategy-prob/);
  assert.match(pageSource, /strategy\.stimulant/);
  assert.match(pageSource, /strategy\.gems/);
  assert.match(pageSource, /strategy\.itemLevelUp/);
});

test('target extraction includes checked negative and zero deltas', () => {
  assert.match(pageSource, /checkedKeys\.map\(/);
  assert.doesNotMatch(pageSource, /v > 0 && checkedKeys\.includes\(k\)/);
});

test('displayResults preserves result containers and clears only dynamic content', () => {
  const displayResultsStart = pageSource.indexOf('const displayResults = (result, targetDeltas) => {');
  const filterStart = pageSource.indexOf('// ---- Filter ----', displayResultsStart);
  assert.ok(displayResultsStart >= 0 && filterStart > displayResultsStart);
  const displayResultsSource = pageSource.slice(displayResultsStart, filterStart);

  assert.doesNotMatch(displayResultsSource, /deconResultContent\.replaceChildren\(\)/);
  assert.match(
    displayResultsSource,
    /deconResultContent\.querySelector\('\.decon-summary'\)\?\.remove\(\)/,
  );
  assert.match(displayResultsSource, /deconResultContent\.prepend\(summary\)/);

  const emptyResultIndex = displayResultsSource.indexOf('if (result.strategies.length === 0)');
  const overflowResultIndex = displayResultsSource.indexOf('if (result.tooManyResults)');
  const filterClearIndex = displayResultsSource.indexOf('filterChipsContainer.replaceChildren()');
  const listClearIndex = displayResultsSource.indexOf('listContainer.replaceChildren()');
  assert.ok(overflowResultIndex >= 0 && overflowResultIndex < emptyResultIndex);
  assert.ok(filterClearIndex >= 0 && filterClearIndex < overflowResultIndex);
  assert.ok(listClearIndex >= 0 && listClearIndex < overflowResultIndex);
  assert.match(
    displayResultsSource,
    /if \(result\.tooManyResults\) \{\s*summary\.textContent = '일치하는 전략이 1,000개를 초과합니다\. 위 패널에서 목표 조건을 더 구체적으로 선택해주세요\.';\s*return;\s*\}/,
  );
  assert.match(
    displayResultsSource,
    /summary\.textContent = `총 \$\{result\.total\}개의 전략을 찾았습니다\.`;/,
  );
  assert.doesNotMatch(displayResultsSource, /result\.truncated/);
});

test('result source filters expose the approved labels and count only all strategies', () => {
  const displayStart = pageSource.indexOf('const displayResults = (result, targetDeltas) => {');
  const filterStart = pageSource.indexOf('// ---- Filter ----', displayStart);
  const displaySource = pageSource.slice(displayStart, filterStart);

  assert.match(displaySource, /\{ source: null, label: '전체' \}/);
  assert.match(displaySource, /\{ source: 'scrolls', label: '주문서' \}/);
  assert.match(displaySource, /\{ source: 'stimulant', label: '촉진제\/추옵' \}/);
  assert.match(displaySource, /\{ source: 'gems', label: '보석 \(메이커\)' \}/);
  assert.match(displaySource, /\{ source: 'itemLevelUp', label: '레벨업' \}/);
  assert.match(
    displaySource,
    /chip\.textContent = def\.source === null\s*\? `\$\{def\.label\} \(\$\{result\.strategies\.length\}\)`\s*:\s*def\.label;/,
  );
  assert.doesNotMatch(displaySource, /updateFilterCounts/);
});

test('result source filters use exact multi-select matching with all fallback', () => {
  const filterStart = pageSource.indexOf('// ---- Filter ----');
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', filterStart);
  const filterSource = pageSource.slice(filterStart, listenersStart);

  assert.match(filterSource, /const selectedResultSources = new Set\(\);/);
  assert.match(
    filterSource,
    /const sourceSetsMatch = \(selectedSources, sourceTypes\) =>\s*selectedSources\.size === sourceTypes\.length\s*&& sourceTypes\.every\(\(source\) => selectedSources\.has\(source\)\);/,
  );
  assert.match(filterSource, /if \(source === null\) \{\s*selectedResultSources\.clear\(\);/);
  assert.match(filterSource, /selectedResultSources\.delete\(source\)/);
  assert.match(filterSource, /selectedResultSources\.add\(source\)/);
  assert.match(filterSource, /const showingAll = selectedResultSources\.size === 0;/);
  assert.match(filterSource, /buildSecondaryFilterModel\(currentResultStrategies, selectedResultSources\)/);
  assert.match(filterSource, /filterEmpty\.hidden = visibleCount > 0;/);
});

test('result filters render a dedicated zero-match message and reset to all per analysis', () => {
  const displayStart = pageSource.indexOf('const displayResults = (result, targetDeltas) => {');
  const filterStart = pageSource.indexOf('// ---- Filter ----', displayStart);
  const displaySource = pageSource.slice(displayStart, filterStart);

  assert.match(displaySource, /filterEmpty\.dataset\.deconFilterEmpty = '';/);
  assert.match(displaySource, /선택한 조합에 해당하는 전략이 없습니다\./);
  assert.match(displaySource, /filterEmpty\.hidden = true;/);
  assert.match(displaySource, /setActiveFilter\(null\);/);
});

test('result panel exposes a secondary-filter container and imports the pure model', () => {
  assert.match(
    pageSource,
    /data-decon-filter-chips><\/div>\s*<div class="decon-secondary-filters" data-decon-secondary-filters hidden><\/div>/,
  );
  assert.match(
    pageSource,
    /import \{[\s\S]*RESULT_SOURCE_ORDER,[\s\S]*buildSecondaryFilterModel,[\s\S]*createInitialSecondarySelections,[\s\S]*getFacetOptions,[\s\S]*getVisibleStrategyIndexes,[\s\S]*\} from '\.\.\/lib\/deconstruction\/resultFilters\.mjs';/,
  );
});

test('primary result changes rebuild or clear secondary filter state', () => {
  const filterStart = pageSource.indexOf('// ---- Filter ----');
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', filterStart);
  const filterSource = pageSource.slice(filterStart, listenersStart);

  assert.match(filterSource, /let currentResultStrategies = \[\];/);
  assert.match(filterSource, /let secondaryFilterModel = null;/);
  assert.match(filterSource, /let selectedSecondaryOptions = new Map\(\);/);
  assert.match(filterSource, /const resetSecondaryFilters = \(\) =>/);
  assert.match(filterSource, /buildSecondaryFilterModel\(currentResultStrategies, selectedResultSources\)/);
  assert.match(filterSource, /createInitialSecondarySelections\(secondaryFilterModel\)/);
  assert.match(filterSource, /if \(showingAll\) \{[\s\S]*resetSecondaryFilters\(\);/);
});

test('secondary checkboxes update selections, availability, and visible cards immediately', () => {
  const filterStart = pageSource.indexOf('// ---- Filter ----');
  const listenersStart = pageSource.indexOf('// ---- Event listeners ----', filterStart);
  const filterSource = pageSource.slice(filterStart, listenersStart);

  assert.match(filterSource, /getFacetOptions\(secondaryFilterModel, selectedSecondaryOptions, source\)/);
  assert.match(filterSource, /input\.checked = checked\.has\(option\.key\);/);
  assert.match(filterSource, /input\.disabled = !option\.available;/);
  assert.match(filterSource, /input\.addEventListener\('change', \(\) =>/);
  assert.match(filterSource, /checked\.(?:add|delete)\(option\.key\)/);
  assert.match(filterSource, /getVisibleStrategyIndexes\(secondaryFilterModel, selectedSecondaryOptions\)/);
  assert.match(filterSource, /renderSecondaryFilters\(\);/);
});

test('calculation step exposes source chips with stable hooks and defaults', () => {
  const targetIndex = pageSource.indexOf('data-decon-target-chips');
  const analyzeIndex = pageSource.indexOf('data-decon-analyze-btn', targetIndex);
  assert.ok(targetIndex >= 0 && analyzeIndex > targetIndex);
  const sourceMarkup = pageSource.slice(targetIndex, analyzeIndex);

  assert.match(sourceMarkup, /분석에 사용할 강화 유형/);
  assert.match(sourceMarkup, /data-decon-source="scrolls"[^>]*checked/);
  assert.match(sourceMarkup, /data-decon-source="stimulant"/);
  assert.match(sourceMarkup, /data-decon-source="gems"/);
  assert.match(sourceMarkup, /data-decon-level-up-source[^>]*hidden[\s\S]*data-decon-source="itemLevelUp"/);
  assert.match(sourceMarkup, /주문서/);
  assert.match(sourceMarkup, /촉진제/);
  assert.match(sourceMarkup, /보석/);
  assert.match(sourceMarkup, /레벨업/);
  assert.match(
    sourceMarkup,
    /id="decon-source-message"[^>]*data-decon-source-message[^>]*aria-live="polite"[^>]*hidden/,
  );
  assert.match(sourceMarkup, /fieldset[^>]*aria-describedby="decon-source-message"/);
  assert.doesNotMatch(sourceMarkup, /data-decon-source="(?:stimulant|gems|itemLevelUp)"[^>]*checked/);
});

test('source permissions use checked visible controls and hide ineligible item level-up', () => {
  assert.match(
    pageSource,
    /import \{[\s\S]*getDefaultSourceSelection,[\s\S]*getSourceValidationMessage,[\s\S]*resolveAllowedSources,[\s\S]*\} from '\.\.\/lib\/deconstruction\/sourcePolicy\.mjs';/,
  );
  assert.match(
    pageSource,
    /const getAllowedSources = \(\) => resolveAllowedSources\([\s\S]*itemLevelUpEligible:[\s\S]*!deconLevelUpSource\.hidden/,
  );
  assert.match(
    pageSource,
    /deconLevelUpSource\.hidden = !selectedItem \|\| !itemLevelUpByItemId\.has\(selectedItem\.id\)/,
  );
});

test('source validation policy controls the message and analyze-button disabled state', () => {
  assert.match(
    pageSource,
    /getSourceValidationMessage\([\s\S]*getAllowedSources\(\),[\s\S]*deconSlotState\.successfulScrollCount,[\s\S]*\)/,
  );
  assert.match(
    pageSource,
    /deconSourceMessage\.hidden = sourceValidationMessage === '';[\s\S]*deconSourceMessage\.textContent = sourceValidationMessage;/,
  );
  assert.match(
    pageSource,
    /deconAnalyzeBtn\.disabled = checkedCount === 0 \|\| sourceValidationMessage !== '';/,
  );
});

test('source choices reset only for selected-item and confirmed calculator resets', () => {
  const selectStart = pageSource.indexOf('const selectSuggestedItem =');
  const suggestionsStart = pageSource.indexOf('const renderItemSuggestions =', selectStart);
  const selectSource = pageSource.slice(selectStart, suggestionsStart);
  assert.match(selectSource, /resetAllowedSources\(\)/);

  const resetStart = pageSource.indexOf("document.querySelector('[data-enhancement-reset]')?.addEventListener");
  const initStart = pageSource.indexOf('// ---- Init ----', resetStart);
  assert.match(pageSource.slice(resetStart, initStart), /resetAllowedSources\(\)/);

  for (const [name, startMarker, endMarker] of [
    ['target renderer', 'const renderTargetChips =', '// ---- Requirement/Stat row definitions'],
    ['stat renderer', 'const rebuildStatEditor =', 'const populateAddStatList ='],
    ['stat editor', 'const setStatDelta =', 'const updateAnalyzeButton ='],
  ]) {
    const start = pageSource.indexOf(startMarker);
    const end = pageSource.indexOf(endMarker, start);
    assert.doesNotMatch(pageSource.slice(start, end), /resetAllowedSources\(\)/, name);
  }
});

test('level-up eligibility refreshes after either item or async level data without resetting choices', () => {
  const selectStart = pageSource.indexOf('const selectSuggestedItem =');
  const suggestionsStart = pageSource.indexOf('const renderItemSuggestions =', selectStart);
  assert.match(pageSource.slice(selectStart, suggestionsStart), /updateLevelUpSourceEligibility\(\)/);

  const levelMapIndex = pageSource.indexOf('itemLevelUpByItemId = new Map(');
  const loadEnd = pageSource.indexOf('\n  })\n  .catch', levelMapIndex);
  const levelLoadSource = pageSource.slice(levelMapIndex, loadEnd);
  assert.match(levelLoadSource, /updateLevelUpSourceEligibility\(\)/);
  assert.doesNotMatch(levelLoadSource, /resetAllowedSources\(\)/);
});

test('successful-scroll changes immediately revalidate analysis', () => {
  assert.match(
    pageSource,
    /const renderDeconSlotState = \(\) => \{[\s\S]*updateTargetCard\(\);[\s\S]*updateAnalyzeButton\(\);[\s\S]*\};/,
  );
});

test('guarded calculation checkboxes defer their visual state until confirmation', () => {
  assert.match(
    pageSource,
    /import \{ guardCheckboxMutation \} from '\.\.\/lib\/deconstruction\/guardedCheckboxMutation\.mjs';/,
  );
  assert.match(
    pageSource,
    /checkbox\.addEventListener\('change', \(\) => \{\s*guardCheckboxMutation\(checkbox, guardDeconMutation, updateAnalyzeButton\);\s*\}\);/,
  );
  assert.match(
    pageSource,
    /deconSourceInputs\.forEach\(\(input\) => \{\s*input\.addEventListener\('change', \(\) => \{\s*guardCheckboxMutation\(input, guardDeconMutation, updateAnalyzeButton\);\s*\}\);\s*\}\);/,
  );
});
