import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const pageSource = await readFile(
  new URL('../src/pages/deconstruction.astro', import.meta.url),
  'utf8',
);
const filterControllerSource = await readFile(
  new URL('../src/lib/deconstruction/resultFilterController.mjs', import.meta.url),
  'utf8',
);
const sourcePolicySource = await readFile(
  new URL('../src/lib/deconstruction/sourcePolicy.mjs', import.meta.url),
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

test('item card formats stat breakdown parentheses without leading base plus or spaces', () => {
  const renderTargetItemCardStart = pageSource.indexOf('const renderTargetItemCard = (item) => {');
  const updateTargetCardStart = pageSource.indexOf('\nconst updateTargetCard = () => {', renderTargetItemCardStart);
  assert.ok(renderTargetItemCardStart >= 0 && updateTargetCardStart > renderTargetItemCardStart);
  const renderTargetItemCardSource = pageSource.slice(renderTargetItemCardStart, updateTargetCardStart);

  assert.match(renderTargetItemCardSource, /const deltaFormatted = delta > 0 \? `\+\$\{delta\}` : String\(delta\);/);
  assert.match(
    renderTargetItemCardSource,
    /const displayValue = `\$\{formatStatValue\(key, total\)\} \(\$\{base\}\$\{deltaFormatted\}\)`;/,
  );
  assert.doesNotMatch(renderTargetItemCardSource, /\(\$\{baseFormatted\} \$\{deltaFormatted\}\)/);
});

test('item card mirrors expected-value level-up metadata and attack-speed placement', () => {
  assert.match(
    pageSource,
    /import \{ HP_MP_KEYS, computeItemLevelUpCardMeta \} from '\.\.\/lib\/enhancementState\.mjs';/,
  );

  const statRowsStart = pageSource.indexOf('const deconStatRows = [');
  const statRowsEnd = pageSource.indexOf('];', statRowsStart);
  assert.ok(statRowsStart >= 0 && statRowsEnd > statRowsStart);
  const statRowsSource = pageSource.slice(statRowsStart, statRowsEnd);
  assert.match(
    statRowsSource,
    /^const deconStatRows = \[\s*\['공격속도', 'attackSpeed'\],/,
    'attack speed must be the first stat row',
  );
  const attackSpeedIndex = statRowsSource.indexOf("['공격속도', 'attackSpeed']");
  const strIndex = statRowsSource.indexOf("['STR', 'str']");
  assert.ok(attackSpeedIndex >= 0, 'missing attack-speed row');
  assert.ok(strIndex >= 0, 'missing STR row');
  assert.ok(attackSpeedIndex < strIndex, 'attack speed must precede STR');

  const renderTargetItemCardStart = pageSource.indexOf('const renderTargetItemCard = (item) => {');
  const updateTargetCardStart = pageSource.indexOf('\nconst updateTargetCard = () => {', renderTargetItemCardStart);
  assert.ok(renderTargetItemCardStart >= 0 && updateTargetCardStart > renderTargetItemCardStart);
  const renderTargetItemCardSource = pageSource.slice(renderTargetItemCardStart, updateTargetCardStart);
  assert.match(
    renderTargetItemCardSource,
    /const itemLevelUpMeta = computeItemLevelUpCardMeta\(\s*\{ itemLevelUpSlots: virtualSlots \},\s*levelUpDef \?\? null,\s*\);/,
  );

  const itemLevelUpGuardStart = renderTargetItemCardSource.indexOf('if (itemLevelUpMeta) {');
  const itemLevelUpGuardEnd = renderTargetItemCardSource.indexOf('\n  }', itemLevelUpGuardStart);
  assert.ok(itemLevelUpGuardStart >= 0 && itemLevelUpGuardEnd > itemLevelUpGuardStart);
  const itemLevelUpGuardSource = renderTargetItemCardSource.slice(itemLevelUpGuardStart, itemLevelUpGuardEnd);
  assert.match(
    itemLevelUpGuardSource,
    /selectedItemRequirements\.append\(\s*createItemLine\('ITEM LEV', itemLevelUpMeta\.itemLevel, 'selected-item-line--item-level'\),?\s*\);/,
  );
  assert.match(
    itemLevelUpGuardSource,
    /selectedItemRequirements\.append\(\s*createItemLine\('ITEM EXP', itemLevelUpMeta\.itemExp, 'selected-item-line--item-level'\),?\s*\);/,
  );

  const levelMapIndex = pageSource.indexOf(
    'itemLevelUpByItemId = new Map(\n      (Array.isArray(itemLevelUps)',
  );
  const loadStart = pageSource.lastIndexOf('.then(([scrolls, itemLevelUps]) => {', levelMapIndex);
  const loadEnd = pageSource.indexOf('\n  })\n  .catch', levelMapIndex);
  assert.ok(loadStart >= 0 && levelMapIndex > loadStart && loadEnd > levelMapIndex);
  const loadSource = pageSource.slice(loadStart, loadEnd);
  const populatedLevelMapIndex = loadSource.indexOf('itemLevelUpByItemId = new Map(');
  const targetCardUpdateIndex = loadSource.indexOf('updateTargetCard();');
  assert.ok(populatedLevelMapIndex >= 0, 'missing populated item-level-up map assignment');
  assert.ok(targetCardUpdateIndex >= 0, 'missing target card refresh');
  assert.ok(
    populatedLevelMapIndex < targetCardUpdateIndex,
    'definition loading must refresh the target card after populating the map',
  );
});

test('target card refresh ignores stale in-memory selection after the selection marker clears', () => {
  const updateTargetCardStart = pageSource.indexOf('const updateTargetCard = () => {');
  const clearSelectedItemCardStart = pageSource.indexOf(
    '\nconst clearSelectedItemCard = () => {',
    updateTargetCardStart,
  );
  assert.ok(updateTargetCardStart >= 0 && clearSelectedItemCardStart > updateTargetCardStart);
  const updateTargetCardSource = pageSource.slice(
    updateTargetCardStart,
    clearSelectedItemCardStart,
  );

  assert.match(
    updateTargetCardSource,
    /if \(\s*selectedItem\s*&&\s*selectedItemIdInput instanceof HTMLInputElement\s*&&\s*selectedItemIdInput\.value === String\(selectedItem\.id\)\s*\) \{\s*renderTargetItemCard\(selectedItem\);\s*\}/,
  );
});

test('item level stepper markup exists and is hidden by default', () => {
  assert.match(pageSource, /data-decon-level-row[^>]*hidden/);
  assert.match(pageSource, /data-decon-level-value/);
  assert.match(pageSource, /data-decon-level-min/);
  assert.match(pageSource, /data-decon-level-inc/);
  assert.match(pageSource, /data-decon-level-dec/);
  assert.match(pageSource, /data-decon-level-max/);
});

test('item level stepper respects level-up definition visibility and engine passthrough', () => {
  const toggleStart = pageSource.indexOf('const updateLevelUpSourceEligibility = () => {');
  const toggleEnd = pageSource.indexOf('\n}', toggleStart);
  const toggleSource = pageSource.slice(toggleStart, toggleEnd);
  assert.match(
    toggleSource,
    /deconLevelUpSource\.hidden = !selectedItem \|\| !itemLevelUpByItemId\.has\(selectedItem\.id\);/
  );

  assert.match(
    pageSource,
    /data-decon-level-row\.hidden = !selectedItem\b/,
  );

  const runAnalysisStart = pageSource.indexOf('const runAnalysis = () => {');
  const displayResultsStart = pageSource.indexOf('const displayResults = (', runAnalysisStart);
  assert.ok(runAnalysisStart >= 0 && displayResultsStart > runAnalysisStart);
  const runAnalysisSource = pageSource.slice(runAnalysisStart, displayResultsStart);
  assert.match(
    runAnalysisSource,
    /const maxLevelUps = Number\.isInteger\(levelUpDef\?\.maxLevelUps\) \? levelUpDef\.maxLevelUps : 0;/,
  );
  assert.match(
    runAnalysisSource,
    /const appliedCount = Math\.max\(0,\s*Math\.min\(maxLevelUps,\s*deconAppliedLevelCount\)\);/,
  );
  assert.match(
    runAnalysisSource,
    /levelUpExactLevelCount:\s*appliedCount/,
  );
});

test('item level card display uses virtual slots from deconAppliedLevelCount', () => {
  const renderTargetItemCardStart = pageSource.indexOf('const renderTargetItemCard = (item) => {');
  const updateTargetCardStart = pageSource.indexOf('\nconst updateTargetCard = () => {', renderTargetItemCardStart);
  const renderSource = pageSource.slice(renderTargetItemCardStart, updateTargetCardStart);
  assert.match(
    renderSource,
    /const alreadyApplied = Math\.max\(0,\s*Math\.min\(maxLevelUps,\s*deconAppliedLevelCount\)\);/,
  );
  assert.match(
    renderSource,
    /Array\(maxLevelUps\)\.fill\(null\)\.map\(\(_\,\s*i\)\s*=>\s*i\s*<\s*alreadyApplied/,
  );
});

test('item level max boundary fills all slots for card and engine', () => {
  const runAnalysisStart = pageSource.indexOf('const runAnalysis = () => {');
  const displayResultsStart = pageSource.indexOf('// ---- Display results ----', runAnalysisStart);
  const runAnalysisSource = pageSource.slice(runAnalysisStart, displayResultsStart);
  assert.match(
    runAnalysisSource,
    /const appliedCount = Math\.max\(0,\s*Math\.min\(maxLevelUps,\s*deconAppliedLevelCount\)\);/,
  );
  assert.match(
    runAnalysisSource,
    /levelUpExactLevelCount:\s*appliedCount/,
  );

  assert.match(
    pageSource,
    /deconLevelMaxBtn\.textContent = 'MAX';/,
  );
});

test('source checkboxes deselected by default', () => {
  const sourceSectionStart = pageSource.indexOf('<fieldset class="decon-source-options"');
  const sourceSectionEnd = pageSource.indexOf('</fieldset>', sourceSectionStart);
  const sourceSection = pageSource.slice(sourceSectionStart, sourceSectionEnd);
  assert.match(sourceSection, /<input type="checkbox" data-decon-source="scrolls"\s*\/>/);
  assert.match(sourceSection, /<input type="checkbox" data-decon-source="stimulant"\s*\/>/);
  assert.match(sourceSection, /<input type="checkbox" data-decon-source="gems"\s*\/>/);
  assert.match(sourceSection, /<input type="checkbox" data-decon-source="itemLevelUp"\s*\/>/);
});

test('scroll rate sub-options exist with correct data attributes', () => {
  assert.match(pageSource, /data-decon-scroll-rate="100"/);
  assert.match(pageSource, /data-decon-scroll-rate="60"/);
  assert.match(pageSource, /data-decon-scroll-rate="10"/);
  assert.match(pageSource, /data-decon-scroll-rate="chaos"/);
  assert.match(pageSource, /data-decon-scroll-rate-sub/);
});

test('stimulant stat bounds sub-options exist', () => {
  assert.match(pageSource, /data-decon-stimulant-bounds/);
  assert.match(pageSource, /dual-range/);
  assert.match(pageSource, /deconStimulantBoundsMap/);
});

test('stimulant result source row is labeled as stimulant/additional option', () => {
  assert.match(
    pageSource,
    /appendSourceRow\(card, deconGemEligible \? '촉진제\/추옵' : '추가 옵션', strategy\.stimulant\.stats\)/,
  );
});

test('level-up total range editor exists for the inputted item level count', () => {
  const toggleStart = pageSource.indexOf('const toggleSourceSub = (sourceCheckbox, subContainer, onFirstEnable) => {');
  const defaultRangeStart = pageSource.indexOf('\nconst buildDefaultSlotRanges', toggleStart);
  assert.ok(toggleStart >= 0 && defaultRangeStart > toggleStart);
  const toggleSource = pageSource.slice(toggleStart, defaultRangeStart);
  assert.match(toggleSource, /if \(enabled\) subContainer\.hidden = false;/);

  const buildStart = pageSource.indexOf('const buildLevelUpSlotEditors = () => {');
  const clearStart = pageSource.indexOf('\nconst renderDeconItemLevel', buildStart);
  assert.ok(buildStart >= 0 && clearStart > buildStart);
  const buildSource = pageSource.slice(buildStart, clearStart);
  assert.match(pageSource, /data-decon-level-slot-ranges/);
  assert.match(buildSource, /data-decon-level-total-range/);
  assert.match(buildSource, /레벨업 총합/);
  assert.doesNotMatch(buildSource, /남은 슬롯/);
});

test('getDefaultSourceSelection returns all false', () => {
  assert.match(pageSource, /getDefaultSourceSelection,?/);
  assert.match(sourcePolicySource, /scrolls:\s*false\b/);
  assert.match(sourcePolicySource, /stimulant:\s*false\b/);
  assert.match(sourcePolicySource, /gems:\s*false\b/);
  assert.match(sourcePolicySource, /itemLevelUp:\s*false\b/);
});

test('runAnalysis passes pre-filter params to engine', () => {
  const runAnalysisStart = pageSource.indexOf('const runAnalysis = () => {');
  const displayResultsStart = pageSource.indexOf('const displayResults = (', runAnalysisStart);
  const runAnalysisSource = pageSource.slice(runAnalysisStart, displayResultsStart);
  assert.match(runAnalysisSource, /scrollRateFilter:\s*deconScrollRateFilter\.size > 0 \? deconScrollRateFilter : null/);
  assert.match(runAnalysisSource, /stimulantStatBounds:\s*Object\.keys\(deconStimulantBoundsMap\)/);
  assert.match(runAnalysisSource, /levelUpExactLevelCount:\s*appliedCount/);
  assert.match(runAnalysisSource, /levelUpTotalStatRanges:\s*appliedCount > 0/);
  assert.doesNotMatch(runAnalysisSource, /levelUpSlotStatRanges/);
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
  assert.match(pageSource, /levelUpDefinition:\s*levelUpDef \?\? null/);
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
    /if \(result\.tooManyResults\) \{\s*summary\.textContent = '일치하는 전략이 10,000개를 초과합니다\. 위 패널에서 목표 조건을 더 구체적으로 선택해주세요\.';\s*return;\s*\}/,
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
  assert.match(displaySource, /stimulantFilterLabel/);
  assert.match(displaySource, /deconGemEligible \? \[\{ source: 'gems', label: '보석 \(메이커\)' \}\] : \[\]/);
  assert.match(displaySource, /\{ source: 'itemLevelUp', label: '레벨업' \}/);
  assert.match(
    displaySource,
    /chip\.textContent = def\.source === null\s*\? `\$\{def\.label\} \(\$\{result\.strategies\.length\}\)`\s*:\s*def\.label;/,
  );
  assert.match(displaySource, /chip\.setAttribute\('aria-pressed', 'false'\);/);
  assert.doesNotMatch(displaySource, /updateFilterCounts/);
});

test('result source filters are mutually exclusive presentation tabs', () => {
  assert.match(filterControllerSource, /let activePanelSource = null;/);
  assert.doesNotMatch(filterControllerSource, /selectedResultSources/);
  assert.doesNotMatch(filterControllerSource, /sourceSetsMatch/);
  assert.match(filterControllerSource, /const setActiveFilter = \(source\) => \{\s*activePanelSource = source;/);
  assert.match(
    filterControllerSource,
    /chip\.classList\.toggle\('decon-filter-chip--active', active\);/,
  );
  assert.match(
    filterControllerSource,
    /chip\.setAttribute\('aria-pressed', String\(active\)\);/,
  );
});

test('result filters render a dedicated zero-match message and reset to all per analysis', () => {
  const displayStart = pageSource.indexOf('const displayResults = (result, targetDeltas) => {');
  const filterStart = pageSource.indexOf('// ---- Filter ----', displayStart);
  const displaySource = pageSource.slice(displayStart, filterStart);

  assert.match(displaySource, /filterEmpty\.dataset\.deconFilterEmpty = '';/);
  assert.match(displaySource, /선택한 조합에 해당하는 전략이 없습니다\./);
  assert.match(displaySource, /filterEmpty\.hidden = true;/);
  assert.match(displaySource, /resultFilterController\.initialize\(result\.strategies\);/);
});

test('result panel exposes a secondary-filter container and imports the filter controller', () => {
  assert.match(
    pageSource,
    /data-decon-filter-chips><\/div>\s*<div class="decon-secondary-filters" data-decon-secondary-filters hidden><\/div>/,
  );
  assert.match(
    pageSource,
    /import \{\s*createResultFilterController,?\s*\} from '\.\.\/lib\/deconstruction\/resultFilterController\.mjs';/,
  );
  assert.doesNotMatch(filterControllerSource, /RESULT_SOURCE_ORDER/);
});

test('completed results initialize global secondary selections once before selecting all', () => {
  const displayStart = pageSource.indexOf('const displayResults = (result, targetDeltas) => {');
  const filterStart = pageSource.indexOf('// ---- Filter ----', displayStart);
  const displaySource = pageSource.slice(displayStart, filterStart);

  assert.match(
    displaySource,
    /resultFilterController\.initialize\(result\.strategies\);/,
  );
  assert.match(displaySource, /resultFilterController\.reset\(\);/);
  assert.match(
    filterControllerSource,
    /model = buildSecondaryFilterModel\(strategies\);\s*selections = createInitialSecondarySelections\(model\);[\s\S]*applyFilters\(\);\s*setActiveFilter\(null\);/,
  );
});

test('filter state resets active panel and primary tabs never rebuild global selections', () => {
  assert.match(filterControllerSource, /let activePanelSource = null;/);
  assert.match(filterControllerSource, /let model = null;/);
  assert.match(filterControllerSource, /let selections = new Map\(\);/);
  assert.match(filterControllerSource, /const reset = \(\) => \{\s*activePanelSource = null;/);

  const setActiveStart = filterControllerSource.indexOf('const setActiveFilter =');
  const resetStart = filterControllerSource.indexOf('const reset =', setActiveStart);
  const setActiveSource = filterControllerSource.slice(setActiveStart, resetStart);
  assert.doesNotMatch(setActiveSource, /buildSecondaryFilterModel/);
  assert.doesNotMatch(setActiveSource, /createInitialSecondarySelections/);
  assert.match(setActiveSource, /if \(source === null\) hidePanel\(\);/);
});

test('global secondary filters toggle cards, count all visible results, and update empty state', () => {
  const applyStart = filterControllerSource.indexOf('const applyFilters =');
  const refreshStart = filterControllerSource.indexOf('const refreshActivePanel =', applyStart);
  const applySource = filterControllerSource.slice(applyStart, refreshStart);

  assert.equal((applySource.match(/getVisibleStrategyIndexes\(/g) ?? []).length, 1);
  assert.match(applySource, /card\.hidden = !visible;/);
  assert.match(applySource, /const allChip = root\.querySelector\('\[data-decon-filter="all"\]'\);/);
  assert.match(applySource, /allChip\.textContent = `전체 \(\$\{visibleCount\}\)`;/);
  assert.match(applySource, /empty\.hidden = visibleCount > 0;/);
  assert.match(applySource, /return visibleCount;/);
});

test('only the active secondary panel renders and checkbox state persists globally', () => {
  assert.equal((filterControllerSource.match(/const renderPanel =/g) ?? []).length, 1);
  assert.doesNotMatch(filterControllerSource, /for \(const source of RESULT_SOURCE_ORDER/);
  assert.match(filterControllerSource, /getFacetOptions\(model, selections, source\)/);
  assert.match(filterControllerSource, /option\.key/);
  assert.match(filterControllerSource, /input\.checked = selected\.has\(option\.key\);/);
  assert.match(filterControllerSource, /input\.disabled = !option\.available;/);
  assert.match(filterControllerSource, /input\.addEventListener\('change', \(\) =>/);
  assert.match(filterControllerSource, /if \(checked\) selected\.add\(key\);\s*else selected\.delete\(key\);/);
  assert.match(filterControllerSource, /applyFilters\(\);\s*refreshActivePanel\(\);/);
});

test('active facet refresh updates and reorders existing option labels in place', () => {
  assert.match(filterControllerSource, /const refreshActivePanel = \(\) =>/);
  assert.match(
    filterControllerSource,
    /renderPanel\(activePanelSource\)/,
  );
  assert.match(filterControllerSource, /decon-secondary-scroll-row--unavailable|decon-secondary-gem-grade--unavailable|decon-secondary-checkbox--unavailable/);
  assert.match(filterControllerSource, /input\.disabled = !option\.available;/);
  assert.match(filterControllerSource, /list\.append\(label\);/);
});

test('calculation step exposes source chips with stable hooks and defaults', () => {
  const targetIndex = pageSource.indexOf('data-decon-target-chips');
  const analyzeIndex = pageSource.indexOf('data-decon-analyze-btn', targetIndex);
  assert.ok(targetIndex >= 0 && analyzeIndex > targetIndex);
  const sourceMarkup = pageSource.slice(targetIndex, analyzeIndex);

  assert.match(sourceMarkup, /분석에 사용할 강화 유형/);
  assert.match(sourceMarkup, /data-decon-source="scrolls"[^>]*\/>/);
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
  const commitStart = pageSource.indexOf('const commitSuggestedItem =');
  const selectStart = pageSource.indexOf('const selectSuggestedItem =', commitStart);
  const commitSource = pageSource.slice(commitStart, selectStart);
  assert.match(commitSource, /resetAllowedSources\(\)/);

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

test('search suggestions do not clear the committed target item before selection', () => {
  const suggestionsStart = pageSource.indexOf('const renderItemSuggestions =');
  const equipmentStart = pageSource.indexOf('const setEquipmentOption =', suggestionsStart);
  const suggestionsSource = pageSource.slice(suggestionsStart, equipmentStart);

  assert.doesNotMatch(suggestionsSource, /selectedItemIdInput\.value = ''/);
  assert.doesNotMatch(suggestionsSource, /form\?\.removeAttribute\('data-selected-item-id'\)/);
  assert.doesNotMatch(suggestionsSource, /clearSelectedItemCard\(\)/);
  assert.doesNotMatch(
    suggestionsSource,
    /deconCalcPlaceholder\.hidden = false|deconCalcContent\.hidden = true/,
  );
});

test('changing away from a drafted deconstruction item requires confirmation', () => {
  assert.match(
    pageSource,
    /const hasDeconDraftState = \(\) => \([\s\S]*deconHasActionableResults[\s\S]*deconResultContent instanceof HTMLElement && !deconResultContent\.hidden[\s\S]*Object\.values\(deconDeltas\)\.some\([\s\S]*\);/,
  );

  const selectStart = pageSource.indexOf('const selectSuggestedItem =');
  const suggestionsStart = pageSource.indexOf('const renderItemSuggestions =', selectStart);
  const selectSource = pageSource.slice(selectStart, suggestionsStart);

  assert.match(
    selectSource,
    /if \(itemChanged && hasDeconDraftState\(\)\) \{\s*showDeconItemChangeDialog\(\(\) => \{\s*commitSuggestedItem\(item, \{ syncFilters \}\);/,
  );
  assert.match(selectSource, /return;\s*\}\s*commitSuggestedItem\(item, \{ syncFilters \}\);/);
  assert.match(
    pageSource,
    /아이템을 변경하면 현재 스탯 편집과 분석 결과가 초기화됩니다\. 계속하시겠습니까\?/,
  );
  assert.match(pageSource, /confirmBtn\.textContent = '변경';/);
});

test('confirmed item changes clear prior deconstruction edits before activation', () => {
  const commitStart = pageSource.indexOf('const commitSuggestedItem =');
  const selectStart = pageSource.indexOf('const selectSuggestedItem =', commitStart);
  const commitSource = pageSource.slice(commitStart, selectStart);

  const clearIndex = commitSource.indexOf('clearDeconCalculationState(item)');
  const selectedItemIndex = commitSource.indexOf('selectedItem = item');
  const activateIndex = commitSource.indexOf('activateDeconEditPanel(item)');

  assert.ok(clearIndex >= 0, 'missing item-change state clear');
  assert.ok(selectedItemIndex > clearIndex, 'state must clear before selectedItem changes');
  assert.ok(activateIndex > selectedItemIndex, 'new item should activate after selectedItem changes');

  const clearStart = pageSource.indexOf('const clearDeconCalculationState =');
  const clearEnd = pageSource.indexOf('const commitSuggestedItem =', clearStart);
  const clearSource = pageSource.slice(clearStart, clearEnd);
  assert.match(clearSource, /deconDeltas = \{\};/);
  assert.match(clearSource, /deconHasActionableResults = false;/);
  assert.match(clearSource, /deconSlotState = createDeconstructionSlotState\(item\?\.stats\?\.upgradeSlots \?\? 0\);/);
});

test('confirmed calculator reset keeps calculation controls visible for the selected item', () => {
  const resetStart = pageSource.indexOf("document.querySelector('[data-enhancement-reset]')?.addEventListener");
  const initStart = pageSource.indexOf('// ---- Init ----', resetStart);
  const resetSource = pageSource.slice(resetStart, initStart);
  const activationIndex = resetSource.indexOf('activateDeconEditPanel(selectedItem)');

  assert.ok(activationIndex >= 0, 'reset must rebuild the selected item edit panel');
  assert.doesNotMatch(
    resetSource.slice(activationIndex),
    /deconCalcPlaceholder\.hidden = false|deconCalcContent\.hidden = true/,
    'reset must not hide the calculation controls after rebuilding the selected item panel',
  );
});

test('level-up eligibility refreshes after either item or async level data without resetting choices', () => {
  const commitStart = pageSource.indexOf('const commitSuggestedItem =');
  const selectStart = pageSource.indexOf('const selectSuggestedItem =', commitStart);
  assert.match(pageSource.slice(commitStart, selectStart), /updateLevelUpSourceEligibility\(\)/);

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
