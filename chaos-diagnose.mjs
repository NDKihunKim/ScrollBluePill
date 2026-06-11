import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

try {
  await page.goto('http://localhost:4321/', { waitUntil: 'networkidle' });

  await page.locator('[data-item-name-input]').fill('노가다 목장갑');
  await page.waitForTimeout(500);
  const suggestions = page.locator('[data-item-suggestions]');
  await suggestions.waitFor({ state: 'visible', timeout: 3000 });
  await suggestions.locator('button').first().click();
  await page.waitForTimeout(500);
  await page.locator('[data-enhancement-active]').waitFor({ state: 'visible', timeout: 3000 });

  await page.screenshot({ path: '/tmp/before-chaos-click.png', fullPage: true });
  console.log('Screenshot 1: before click saved');

  const scrollList = page.locator('[data-scroll-list]');
  const chaosOption = scrollList.locator('.scroll-option').filter({ hasText: '혼돈의 주문서' });
  await chaosOption.first().click();
  await page.waitForTimeout(500);

  await page.screenshot({ path: '/tmp/after-chaos-click.png', fullPage: true });
  console.log('Screenshot 2: after click saved');

  // Diagnose button
  const btnInfo = await chaosOption.first().evaluate(el => {
    const cs = getComputedStyle(el);
    const kids = Array.from(el.children).map(c => ({
      tag: c.tagName,
      class: c.className?.slice(0, 40),
      ow: c.offsetWidth,
      oh: c.offsetHeight,
    }));
    return {
      display: cs.display,
      gridTemplateColumns: cs.gridTemplateColumns,
      height: cs.height,
      minHeight: cs.minHeight,
      backgroundColor: cs.backgroundColor,
      border: cs.border,
      overflow: cs.overflow,
      padding: cs.padding,
      childCount: el.children.length,
      children: kids,
    };
  });
  console.log('Button:', JSON.stringify(btnInfo, null, 2));

  // Diagnose panel
  const panel = chaosOption.first().locator('.chaos-input-panel');
  if (await panel.count() > 0) {
    const panelInfo = await panel.evaluate(el => {
      const cs = getComputedStyle(el);
      return {
        display: cs.display,
        gridColumn: cs.gridColumn,
        gridColumnStart: cs.gridColumnStart,
        gridColumnEnd: cs.gridColumnEnd,
        backgroundColor: cs.backgroundColor,
        border: cs.border,
        borderTop: cs.borderTop,
        width: cs.width,
        height: cs.height,
        background: cs.background,
      };
    });
    console.log('Panel:', JSON.stringify(panelInfo, null, 2));
  }

  // Check if :global rule is actually in the stylesheet
  const hasRule = await page.evaluate(() => {
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          if (rule.selectorText?.includes('chaos-input-panel')) {
            return { selector: rule.selectorText, cssText: rule.cssText };
          }
        }
      } catch(e) {}
    }
    return null;
  });
  console.log('CSS rule:', JSON.stringify(hasRule, null, 2));

} catch (e) {
  console.error('Error:', e.message);
} finally {
  await browser.close();
}
