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
  <div data-decon-filter-chips></div>
  <div data-decon-secondary-filters hidden></div>
  <div data-decon-result-content>
    <p data-decon-filter-empty hidden>empty</p>
    <div class="decon-strategy-card" data-strategy-index="0">0</div>
    <div class="decon-strategy-card" data-strategy-index="1">1</div>
    <div class="decon-strategy-card" data-strategy-index="2">2</div>
    <div class="decon-strategy-card" data-strategy-index="3">3</div>
    <div class="decon-strategy-card" data-strategy-index="4">4</div>
    <div class="decon-strategy-card" data-strategy-index="5">5</div>
    <div class="decon-strategy-card" data-strategy-index="6">6</div>
  </div>
  <script type="module">
    import { createResultFilterController } from '/deconstruction/resultFilterController.mjs';
    import { createPagination } from '/deconstruction/pagination.mjs';
    window.renderFilterChips = () => {
      document.querySelector('[data-decon-filter-chips]').innerHTML = [
        '<button data-decon-filter="all" aria-pressed="false">전체 (7)</button>',
        '<button data-decon-filter="stimulant" aria-pressed="false">촉진제/추옵</button>',
      ].join('');
    };
    window.renderFilterChips();
    // 7 strategies → 2 pages. Stimulant stats stay within the slider
    // limits so opening the stimulant tab never filters anything out.
    window.testStrategies = Array.from({ length: 7 }, (_, i) => ({
      scrolls: [{ id: 's' + i, nameKo: 'S' + i }],
      stimulant: { stats: { str: (i % 5) + 1 } },
      gems: [],
      itemLevelUp: null,
    }));
    try {
      window.pagination = createPagination('[data-decon-result-content]');
      window.controller = createResultFilterController({
        root: document,
        secondaryContainer: document.querySelector('[data-decon-secondary-filters]'),
      });
      window.controller.initialize(window.testStrategies, {
        onAfterFilter: () => window.pagination.applyPagination(true),
      });
      window.pagination.renderBar();
      window.pagination.applyPagination();
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
      response.end('export function createPagination() { throw new Error("pagination is not implemented"); }');
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

const nextButton = () => page.locator('.decon-page-btn').nth(2);
const indicator = () => page.locator('.decon-page-indicator');

test('clicking a filter tab does not shrink pagination to one page', async (t) => {
  t.after(() => page.close());

  // Unfiltered: 7 strategies, page 1 of 2.
  assert.equal(await indicator().textContent(), '1 / 2');
  assert.equal(await nextButton().isDisabled(), false);
  assert.equal(await page.locator('[data-strategy-index="5"]').isHidden(), true);

  // Opening the 촉진제/추옵 tab changes no filter state, so pagination
  // must keep paging over all 7 cards.
  await page.locator('[data-decon-filter="stimulant"]').click();

  assert.equal(await indicator().textContent(), '1 / 2');
  assert.equal(await nextButton().isDisabled(), false);

  await nextButton().click();
  assert.equal(await indicator().textContent(), '2 / 2');
  assert.equal(await page.locator('[data-strategy-index="5"]').isVisible(), true);
  assert.equal(await page.locator('[data-strategy-index="0"]').isHidden(), true);
});
