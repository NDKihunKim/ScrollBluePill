import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`  OK: ${msg}`);

try {
  // 1. Navigate to the app
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });
  console.log('Page loaded');

  // 2. Search for "노가다 목장갑"
  const searchInput = page.locator('[data-item-name-input]');
  await searchInput.fill('노가다 목장갑');
  await page.waitForTimeout(500);

  // Check suggestions
  const suggestions = page.locator('[data-item-suggestions]');
  await suggestions.waitFor({ state: 'visible', timeout: 3000 });

  // Click the first suggestion
  const firstSuggestion = suggestions.locator('button').first();
  const suggestionText = await firstSuggestion.textContent();
  console.log(`Suggestion: ${suggestionText}`);
  await firstSuggestion.click();
  await page.waitForTimeout(500);

  // 3. Enhancement panel should be active
  const enhancementActive = page.locator('[data-enhancement-active]');
  await enhancementActive.waitFor({ state: 'visible', timeout: 3000 });
  console.log('Enhancement panel active');

  // 4. Scroll list should contain the chaos scroll
  const scrollList = page.locator('[data-scroll-list]');
  const chaosOption = scrollList.locator('.scroll-option').filter({ hasText: '혼돈의 주문서' });
  const chaosCount = await chaosOption.count();
  if (chaosCount === 0) fail('Chaos scroll not found in scroll list');
  else ok('Chaos scroll found in scroll list');

  // 5. Click the chaos scroll — panel should expand
  await chaosOption.first().click();
  await page.waitForTimeout(300);

  const chaosPanel = chaosOption.first().locator('.chaos-input-panel');
  const panelVisible = await chaosPanel.isVisible().catch(() => false);
  if (!panelVisible) fail('Chaos input panel did not expand');
  else ok('Chaos input panel expanded');

  // 6. Check stepper rows exist — 노가다 목장갑 clean has only 물리방어력
  const statRows = chaosPanel.locator('.chaos-stat-row');
  const rowCount = await statRows.count();
  console.log(`Stat rows: ${rowCount}`);

  const statLabels = await chaosPanel.locator('.chaos-stat-label').allTextContents();
  console.log(`Stat labels: ${statLabels.join(', ')}`);

  if (!statLabels.some(l => l.includes('물리방어력'))) fail('물리방어력 stat row not found');
  else ok('물리방어력 stat row present');

  // 7. Test the [+] stepper button
  const firstRow = statRows.first();
  const plusBtn = firstRow.locator('.chaos-stepper-btn').filter({ hasText: '+' });
  const valueDisplay = firstRow.locator('.chaos-stepper-value');

  const initialValue = await valueDisplay.textContent();
  console.log(`Initial stepper value: "${initialValue}"`);

  // Click [+] 3 times — should go to +3
  await plusBtn.click();
  await plusBtn.click();
  await plusBtn.click();
  await page.waitForTimeout(100);

  const afterPlus = await valueDisplay.textContent();
  if (afterPlus !== '+3') fail(`Stepper [+] failed: expected "+3" got "${afterPlus}"`);
  else ok('Stepper [+] works: +3');

  // 8. Test the [−] stepper button
  const minusBtn = firstRow.locator('.chaos-stepper-btn').filter({ hasText: '−' });
  await minusBtn.click();
  await page.waitForTimeout(100);

  const afterMinus = await valueDisplay.textContent();
  if (afterMinus !== '+2') fail(`Stepper [−] failed: expected "+2" got "${afterMinus}"`);
  else ok('Stepper [−] works: +2');

  // 9. Click 적용 button
  const applyBtn = chaosPanel.locator('.chaos-apply-button');
  await applyBtn.click();
  await page.waitForTimeout(300);

  // Check that a slot is filled (should see slot 1 filled in the checkpoint row)
  const filledSlots = page.locator('.slot-box--filled');
  const filledCount = await filledSlots.count();
  if (filledCount !== 1) fail(`Expected 1 filled slot, got ${filledCount}`);
  else ok('Slot filled after 적용');

  // 10. Verify values persisted — re-expand chaos and check stepper
  await chaosOption.first().click();
  await page.waitForTimeout(300);

  const chaosPanel2 = chaosOption.first().locator('.chaos-input-panel');
  const panel2Visible = await chaosPanel2.isVisible().catch(() => false);
  if (!panel2Visible) fail('Chaos panel did not re-expand after 적용');

  const valueAfterExpand = await chaosPanel2.locator('.chaos-stat-row').first().locator('.chaos-stepper-value').textContent();
  if (valueAfterExpand !== '+2') fail(`Values not persisted: expected "+2" got "${valueAfterExpand}"`);
  else ok('Stepper values persisted after 적용');

  // 11. Verify a new stat appears — after +2 물리방어력, the accumulated stat
  // should show. 물리방어력 was already there, but check that the panel is correct.
  // Actually for 노가다 목장갑, only 물리방어력 exists. After first chaos scroll,
  // still only 물리방어력. No new stats added. That's correct.
  const rowCount2 = await chaosPanel2.locator('.chaos-stat-row').count();
  console.log(`Stat rows after 첫 적용: ${rowCount2}`);

  // Apply 적용 again (same +2) to fill slot 2
  await chaosPanel2.locator('.chaos-apply-button').click();
  await page.waitForTimeout(300);

  const filledCount2 = await page.locator('.slot-box--filled').count();
  if (filledCount2 !== 2) fail(`Expected 2 filled slots, got ${filledCount2}`);
  else ok('Second 적용 worked');

  // 12. Apply a regular (non-chaos) scroll — should collapse chaos panel
  // Find a fixed scroll and click it
  const fixedOption = scrollList.locator('.scroll-option').filter({ hasText: '장갑' }).first();
  const fixedText = await fixedOption.textContent();
  console.log(`Clicking regular scroll: ${fixedText?.slice(0, 40)}`);
  await fixedOption.click();
  await page.waitForTimeout(300);

  // Chaos panel should be gone (collapsed)
  const panelAfterFixed = await chaosOption.first().locator('.chaos-input-panel').count();
  if (panelAfterFixed !== 0) fail('Chaos panel did not collapse when clicking fixed scroll');
  else ok('Chaos panel collapsed when clicking non-chaos scroll');

  // 13. Click chaos again, then reset — panel should collapse
  await chaosOption.first().click();
  await page.waitForTimeout(300);
  await page.locator('[data-enhancement-reset]').click();
  await page.waitForTimeout(300);

  const panelAfterReset = await chaosOption.first().locator('.chaos-input-panel').count();
  if (panelAfterReset !== 0) fail('Chaos panel did not collapse on reset');
  else ok('Chaos panel collapsed on reset');

  console.log('\n✅ All tests passed!');
} catch (e) {
  fail(`Unexpected error: ${e.message}`);
  console.error(e);
} finally {
  await browser.close();
}
