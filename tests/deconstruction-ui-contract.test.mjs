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

test('analysis passes the exact successful-scroll count to the engine', () => {
  const runAnalysisStart = pageSource.indexOf('const runAnalysis = () => {');
  const displayResultsStart = pageSource.indexOf('// ---- Display results ----', runAnalysisStart);
  assert.ok(runAnalysisStart >= 0 && displayResultsStart > runAnalysisStart);
  const runAnalysisSource = pageSource.slice(runAnalysisStart, displayResultsStart);

  assert.match(
    runAnalysisSource,
    /enumerateStrategies\(\{[\s\S]*successfulScrollCount: deconSlotState\.successfulScrollCount,[\s\S]*equipmentKind,[\s\S]*scrollsByEquipmentKind,[\s\S]*\}\)/,
  );
  assert.doesNotMatch(runAnalysisSource, /\bupgradeSlots\b/);
});
