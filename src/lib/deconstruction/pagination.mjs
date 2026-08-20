/**
 * Deconstruction pagination bar.
 *
 * Extracted from deconstruction.astro — encapsulates the page-navigation
 * bar rendering, page state, and filter/pagination visibility logic.
 *
 * Usage:
 *   const pagination = createPagination('[data-decon-result-panel]');
 *   pagination.renderBar();        // build & inject the bar
 *   pagination.applyPagination();  // called after results render
 *   pagination.applyPagination(true); // called after filter changes
 */

const PAGE_SIZE = 5;

/**
 * Creates a pagination controller bound to a result panel.
 *
 * @param {string} containerSelector — CSS selector for the result panel element
 * @returns {{ renderBar: () => void, applyPagination: (isFilterUpdate?: boolean) => void,
 *   resetPage: () => void, goToPage: (page: number, opts?: {scroll?: boolean}) => void }}
 */
export function createPagination(containerSelector) {
  let _currentPage = 1;
  let _totalStrategies = 0;
  let _filterHiddenIndices = new Set();

  // ── Internal helpers ─────────────────────────────────────────

  function _goToPage(page, { scroll = true } = {}) {
    const totalPages = Math.max(1, Math.ceil(_totalStrategies / PAGE_SIZE));
    _currentPage = Math.max(1, Math.min(page, totalPages));
    _applyPagination();
    if (scroll) {
      const panel = document.querySelector(containerSelector);
      if (panel instanceof HTMLElement) {
        panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  function _updateBar() {
    const bar = document.querySelector('.decon-pagination-bar');
    if (!(bar instanceof HTMLElement)) return;

    if (_totalStrategies === 0) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;

    const totalPages = Math.max(1, Math.ceil(_totalStrategies / PAGE_SIZE));
    const buttons = bar.querySelectorAll('.decon-page-btn');
    const firstBtn = buttons[0];
    const prevBtn = buttons[1];
    const nextBtn = buttons[2];
    const lastBtn = buttons[3];
    const indicator = bar.querySelector('.decon-page-indicator');

    if (firstBtn instanceof HTMLButtonElement) firstBtn.disabled = _currentPage <= 1;
    if (prevBtn instanceof HTMLButtonElement) prevBtn.disabled = _currentPage <= 1;
    if (nextBtn instanceof HTMLButtonElement) nextBtn.disabled = _currentPage >= totalPages;
    if (lastBtn instanceof HTMLButtonElement) lastBtn.disabled = _currentPage >= totalPages;
    if (indicator instanceof HTMLElement) {
      indicator.textContent = `${_currentPage} / ${totalPages}`;
    }
  }

  function _applyPagination(isFilterUpdate = false) {
    const cards = [...document.querySelectorAll('.decon-strategy-card')];
    if (cards.length === 0) return;

    // On filter updates, snapshot which cards the filter hides.
    if (isFilterUpdate) {
      _filterHiddenIndices = new Set();
      cards.forEach((card, i) => {
        if (card.hidden) _filterHiddenIndices.add(i);
      });
    }

    // Count filter-passing cards (total minus filter-hidden)
    const filterPassingCount = cards.length - _filterHiddenIndices.size;
    const totalPages = Math.max(1, Math.ceil(filterPassingCount / PAGE_SIZE));
    if (_currentPage > totalPages) _currentPage = totalPages;

    const startIdx = (_currentPage - 1) * PAGE_SIZE;
    const endIdx = startIdx + PAGE_SIZE;

    // Apply both filter and pagination visibility
    let visibleIdx = 0;
    cards.forEach((card, i) => {
      if (_filterHiddenIndices.has(i)) {
        card.hidden = true;
      } else {
        card.hidden = visibleIdx < startIdx || visibleIdx >= endIdx;
        visibleIdx++;
      }
    });

    _totalStrategies = filterPassingCount;
    _updateBar();
  }

  // ── Public API ───────────────────────────────────────────────

  /** Build the pagination bar and inject it into the result panel. */
  function renderBar() {
    const resultPanel = document.querySelector(containerSelector);
    if (!(resultPanel instanceof HTMLElement)) return;

    // Remove old pagination bar if any
    resultPanel.querySelector('.decon-pagination-bar')?.remove();

    const bar = document.createElement('div');
    bar.className = 'decon-pagination-bar';

    const firstBtn = document.createElement('button');
    firstBtn.className = 'decon-page-btn';
    firstBtn.setAttribute('aria-label', '첫 페이지');
    firstBtn.textContent = '«';
    firstBtn.addEventListener('click', () => _goToPage(1));

    const prevBtn = document.createElement('button');
    prevBtn.className = 'decon-page-btn';
    prevBtn.setAttribute('aria-label', '이전 페이지');
    prevBtn.textContent = '←';
    prevBtn.addEventListener('click', () => _goToPage(_currentPage - 1));

    const indicator = document.createElement('span');
    indicator.className = 'decon-page-indicator';

    const nextBtn = document.createElement('button');
    nextBtn.className = 'decon-page-btn';
    nextBtn.setAttribute('aria-label', '다음 페이지');
    nextBtn.textContent = '→';
    nextBtn.addEventListener('click', () => _goToPage(_currentPage + 1));

    const lastBtn = document.createElement('button');
    lastBtn.className = 'decon-page-btn';
    lastBtn.setAttribute('aria-label', '마지막 페이지');
    lastBtn.textContent = '»';
    lastBtn.addEventListener('click', () => _goToPage(Number.MAX_SAFE_INTEGER));

    bar.append(firstBtn, prevBtn, indicator, nextBtn, lastBtn);
    if (_totalStrategies === 0) bar.hidden = true;
    resultPanel.appendChild(bar);

    _updateBar();
  }

  /** Reset to page 1 (call when new results are generated). */
  function resetPage() {
    _currentPage = 1;
  }

  return { renderBar, applyPagination: _applyPagination, resetPage, goToPage: _goToPage };
}
