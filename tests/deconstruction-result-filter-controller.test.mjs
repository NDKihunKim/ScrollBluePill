import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, before, beforeEach, test } from 'node:test';
import { chromium } from 'playwright';

const libRoot = fileURLToPath(new URL('../src/lib/', import.meta.url));
const fixture = `<!doctype html>
<html><body>
  <div data-decon-filter-chips>
    <button data-decon-filter="all" aria-pressed="false">전체 (3)</button>
    <button data-decon-filter="scrolls" aria-pressed="false">주문서</button>
    <button data-decon-filter="stimulant" aria-pressed="false">촉진제/추옵</button>
    <button data-decon-filter="gems" aria-pressed="false">보석 (메이커)</button>
  </div>
  <div data-decon-secondary-filters hidden></div>
  <div data-decon-strategy-list>
    <p data-decon-filter-empty hidden>empty</p>
    <div class="decon-strategy-card" data-strategy-index="0">A + X</div>
    <div class="decon-strategy-card" data-strategy-index="1">B + Y</div>
    <div class="decon-strategy-card" data-strategy-index="2">C</div>
  </div>
  <script type="module">
    import { createResultFilterController } from '/deconstruction/resultFilterController.mjs';
    const strategies = [
      { scrolls: [{ id: 'a', nameKo: 'A' }], stimulant: { stats: { str: 1 } }, gems: [], itemLevelUp: null },
      { scrolls: [{ id: 'b', nameKo: 'B' }], stimulant: { stats: { str: 2 } }, gems: [], itemLevelUp: null },
      { scrolls: [{ id: 'c', nameKo: 'C' }], stimulant: null, gems: [], itemLevelUp: null },
    ];
    try {
      window.controller = createResultFilterController({
        root: document,
        secondaryContainer: document.querySelector('[data-decon-secondary-filters]'),
      });
      window.controller.initialize(strategies);
    } catch (error) {
      window.harnessError = String(error?.message ?? error);
    }
    window.harnessReady = true;
  </script>
</body></html>`;

let server;
let origin;
let browser;
let page;

before(async () => {
  server = createServer(async (request, response) => {
    if (request.url === '/') {
      response.setHeader('content-type', 'text/html; charset=utf-8');
      response.end(fixture);
      return;
    }

    const requestedPath = normalize(join(libRoot, decodeURIComponent(request.url ?? '/').slice(1)));
    if (!requestedPath.startsWith(libRoot)) {
      response.writeHead(403).end();
      return;
    }
    if (!existsSync(requestedPath)) {
      response.setHeader('content-type', 'text/javascript; charset=utf-8');
      response.end('export function createResultFilterController() { throw new Error("result filter controller is not implemented"); }');
      return;
    }
    response.setHeader('content-type', 'text/javascript; charset=utf-8');
    response.end(await readFile(requestedPath));
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  origin = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch({ headless: true });
});

after(async () => {
  await browser?.close();
  await new Promise((resolve) => server?.close(resolve));
});

beforeEach(async () => {
  page = await browser.newPage();
  await page.goto(origin);
  await page.waitForFunction(() => window.harnessReady === true);
  assert.equal(await page.evaluate(() => window.harnessError), undefined);
});

test('primary buttons are mutually exclusive pressed controls and all preserves exclusions', async (t) => {
  t.after(() => page.close());

  assert.deepEqual(
    await page.locator('[data-decon-filter]').evaluateAll((buttons) =>
      buttons.map((button) => [button.dataset.deconFilter, button.getAttribute('aria-pressed')])),
    [['all', 'true'], ['scrolls', 'false'], ['stimulant', 'false'], ['gems', 'false']],
  );

  await page.locator('[data-decon-filter="scrolls"]').click();
  assert.equal(await page.locator('[aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('[data-decon-filter="scrolls"]').getAttribute('aria-pressed'), 'true');
  await page.locator('[data-decon-option-key="scroll:a"] input').click();

  await page.locator('[data-decon-filter="stimulant"]').click();
  await page.locator('[data-decon-filter="scrolls"]').click();
  assert.equal(await page.locator('[data-decon-option-key="scroll:a"] input').isChecked(), false);

  await page.locator('[data-decon-filter="all"]').click();
  assert.equal(await page.locator('[data-decon-secondary-filters]').isHidden(), true);
  assert.equal(await page.locator('[data-strategy-index="0"]').isHidden(), true);
  assert.equal(await page.locator('[data-decon-filter="all"]').textContent(), '전체 (2)');
});

test('secondary exclusions update visibility, count, empty state, and remain recoverable', async (t) => {
  t.after(() => page.close());
  await page.locator('[data-decon-filter="scrolls"]').click();

  for (const key of ['scroll:a', 'scroll:b', 'scroll:c']) {
    await page.locator(`[data-decon-option-key="${key}"] input`).click();
  }
  assert.equal(await page.locator('.decon-strategy-card:visible').count(), 0);
  assert.equal(await page.locator('[data-decon-filter="all"]').textContent(), '전체 (0)');
  assert.equal(await page.locator('[data-decon-filter-empty]').isVisible(), true);
  assert.equal(await page.locator('[data-decon-option-key="scroll:b"] input').isDisabled(), false);

  await page.locator('[data-decon-option-key="scroll:b"] input').click();
  assert.equal(await page.locator('[data-strategy-index="1"]').isVisible(), true);
  assert.equal(await page.locator('[data-decon-filter-empty]').isHidden(), true);
});

test('hidden-facet changes disable and reorder active labels without replacing nodes', async (t) => {
  t.after(() => page.close());
  await page.locator('[data-decon-filter="scrolls"]').click();
  await page.evaluate(() => {
    window.savedScrollLabel = document.querySelector('[data-decon-option-key="scroll:a"]');
    window.controller.setSecondaryOption('stimulant', 'stimulant:str:1', false);
  });

  assert.equal(
    await page.evaluate(() => window.savedScrollLabel === document.querySelector('[data-decon-option-key="scroll:a"]')),
    true,
  );
  assert.equal(await page.locator('[data-decon-option-key="scroll:a"] input').isDisabled(), true);
  assert.deepEqual(
    await page.locator('[data-decon-option-key]').evaluateAll((labels) =>
      labels.map((label) => label.dataset.deconOptionKey)),
    ['scroll:b', 'scroll:c', 'scroll:a'],
  );

  await page.locator('[data-decon-filter="gems"]').click();
  assert.equal(await page.locator('[data-decon-secondary-filters]').isHidden(), true);
});
