/**
 * Shared item-search UI helpers used by both deconstruction and
 * expected-value pages. Extracted to eliminate ~150 lines of
 * near-identical duplication across the two page scripts.
 */
import { normalizeItemLevelRange } from './calculatorInput.mjs';

// ── DOM helpers ──────────────────────────────────────────────

/**
 * Sync visual active state on job filter buttons to match their
 * underlying checkbox state.
 */
export function syncJobButtons(jobInputs) {
  jobInputs?.forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.closest('.choice-button')?.classList.toggle('active', input.checked);
  });
}

/**
 * Hide the auto-suggest dropdown and reset aria state.
 */
export function hideItemSuggestions(itemSuggestions, itemNameInput) {
  if (itemSuggestions instanceof HTMLElement) {
    itemSuggestions.hidden = true;
  }
  if (itemNameInput instanceof HTMLInputElement) {
    itemNameInput.setAttribute('aria-expanded', 'false');
  }
}

// ── URL & filtering ──────────────────────────────────────────

/**
 * Build a maplestory.io search URL from the current filter inputs
 * and stash it on the form for later navigation.
 */
export function syncItemSearchUrl({
  itemNameInput,
  equipmentInput,
  levelMinInput,
  levelMaxInput,
  form,
  buildItemSearchUrl,
}) {
  if (!(itemNameInput instanceof HTMLInputElement) || !(equipmentInput instanceof HTMLInputElement))
    return;

  const levelRange =
    levelMinInput instanceof HTMLInputElement && levelMaxInput instanceof HTMLInputElement
      ? normalizeItemLevelRange(levelMinInput.value, levelMaxInput.value)
      : normalizeItemLevelRange(0, 0);

  form?.setAttribute(
    'data-item-search-url',
    buildItemSearchUrl({
      searchFor: itemNameInput.value,
      equipmentKind: equipmentInput.value,
      requiredLevelMin: levelRange.min,
      requiredLevelMax: levelRange.max,
    }),
  );
}

/**
 * Filter the global item index by equipment kind, level range,
 * and selected job constraints.  Returns a sorted result array.
 */
export function getManualFilteredItems({
  equipmentInput,
  jobInputs,
  levelMinInput,
  levelMaxInput,
  itemIndex,
  getSelectedJobKinds,
  itemMatchesSelectedJobs,
}) {
  if (!(equipmentInput instanceof HTMLInputElement)) return [];
  if (!equipmentInput.value) return [];

  const selectedJobs = getSelectedJobKinds(jobInputs);
  const levelRange =
    levelMinInput instanceof HTMLInputElement && levelMaxInput instanceof HTMLInputElement
      ? normalizeItemLevelRange(levelMinInput.value, levelMaxInput.value)
      : normalizeItemLevelRange(0, 0);

  return itemIndex
    .filter((item) => item.equipmentKind === equipmentInput.value)
    .filter((item) => item.requiredLevel >= levelRange.min && item.requiredLevel <= levelRange.max)
    .filter((item) => itemMatchesSelectedJobs(item, selectedJobs))
    .sort((a, b) => a.requiredLevel - b.requiredLevel || a.nameKo.localeCompare(b.nameKo, 'ko-KR'));
}

// ── Rendering ────────────────────────────────────────────────

const MAX_MANUAL_RESULTS = 100;

/**
 * Render the auto-suggest dropdown beneath the item-name input.
 * `onSelectItem(item)` is called when the user clicks a suggestion.
 */
export function renderItemSuggestions({
  itemNameInput,
  itemSuggestions,
  itemIndex,
  buildItemIconUrl,
  searchKoreanItems,
  onSelectItem,
}) {
  if (!(itemNameInput instanceof HTMLInputElement) || !(itemSuggestions instanceof HTMLElement))
    return;

  itemSuggestions.replaceChildren();

  const results = searchKoreanItems(itemNameInput.value, { items: itemIndex });
  if (results.length === 0) {
    hideItemSuggestions(itemSuggestions, itemNameInput);
    return;
  }

  results.forEach((item) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'item-suggestion-option';
    option.setAttribute('role', 'option');
    option.id = `item-suggestion-${item.id}`;
    option.dataset.itemId = String(item.id);

    const icon = document.createElement('img');
    icon.className = 'item-suggestion-icon';
    icon.src = buildItemIconUrl(item.id);
    icon.alt = '';
    icon.loading = 'lazy';

    const text = document.createElement('span');
    text.className = 'item-suggestion-text';
    const name = document.createElement('strong');
    name.textContent = item.nameKo;
    const meta = document.createElement('span');
    meta.textContent = item.equipmentKind;
    text.append(name, meta);

    option.append(icon, text);
    option.addEventListener('click', () => {
      onSelectItem(item);
    });
    itemSuggestions.append(option);
  });

  itemSuggestions.hidden = false;
  itemNameInput.setAttribute('aria-expanded', 'true');
}

/**
 * Render the manual (equipment-filtered) item result list.
 * `onSelectItem(item)` is called when the user clicks a result.
 */
export function renderManualItemResults({
  manualItemResults,
  getFilteredItems,
  buildItemIconUrl,
  onSelectItem,
}) {
  if (!(manualItemResults instanceof HTMLElement)) return;
  manualItemResults.replaceChildren();

  const results = getFilteredItems();
  if (results.length === 0) {
    manualItemResults.hidden = true;
    return;
  }

  if (results.length > MAX_MANUAL_RESULTS) {
    const warning = document.createElement('div');
    warning.className = 'manual-item-overflow-warning';
    warning.textContent = '검색 결과가 너무 많습니다. 위에 필터들을 더 좁혀주세요.';
    manualItemResults.append(warning);
    manualItemResults.hidden = false;
    return;
  }

  const list = document.createElement('div');
  list.className = 'manual-item-list';
  results.forEach((item) => {
    const option = document.createElement('button');
    option.type = 'button';
    option.className = 'manual-item-option';
    option.dataset.itemId = String(item.id);

    const icon = document.createElement('img');
    icon.className = 'manual-item-icon';
    icon.src = buildItemIconUrl(item.id);
    icon.alt = '';
    icon.loading = 'lazy';

    const text = document.createElement('span');
    text.className = 'manual-item-text';
    const name = document.createElement('strong');
    name.textContent = item.nameKo;
    const meta = document.createElement('span');
    meta.textContent = item.equipmentKind;
    text.append(name, meta);

    option.append(icon, text);
    option.addEventListener('click', () => {
      onSelectItem(item, { syncFilters: false });
    });
    list.append(option);
  });

  manualItemResults.append(list);
  manualItemResults.hidden = false;
}

// ── Keyboard navigation ──────────────────────────────────────

/**
 * Handle keyboard navigation within the item suggestion listbox.
 * Implements the aria-activedescendant combobox pattern:
 * - ArrowDown: move to next option (or first if none active)
 * - ArrowUp: move to previous option
 * - Enter: select the active option
 * - Escape: hide suggestions
 *
 * Returns true if the event was handled (caller should prevent default),
 * false if it should propagate normally.
 */
export function handleSuggestionKeydown(event, { itemNameInput, itemSuggestions, findItemById, onSelectItem }) {
  if (!(itemSuggestions instanceof HTMLElement) || itemSuggestions.hidden) return false;

  const options = Array.from(itemSuggestions.querySelectorAll('[role="option"]'));
  if (options.length === 0) return false;

  const activeId = itemNameInput instanceof HTMLInputElement
    ? itemNameInput.getAttribute('aria-activedescendant')
    : null;
  const activeIndex = activeId ? options.findIndex((o) => o.id === activeId) : -1;

  if (event.key === 'ArrowDown') {
    event.preventDefault();
    const nextIndex = activeIndex < options.length - 1 ? activeIndex + 1 : 0;
    const nextOption = options[nextIndex];
    if (itemNameInput instanceof HTMLInputElement) {
      itemNameInput.setAttribute('aria-activedescendant', nextOption.id);
    }
    options.forEach((o) => o.classList.remove('item-suggestion-option--focused'));
    nextOption.classList.add('item-suggestion-option--focused');
    nextOption.scrollIntoView({ block: 'nearest' });
    return true;
  }

  if (event.key === 'ArrowUp') {
    event.preventDefault();
    const prevIndex = activeIndex > 0 ? activeIndex - 1 : options.length - 1;
    const prevOption = options[prevIndex];
    if (itemNameInput instanceof HTMLInputElement) {
      itemNameInput.setAttribute('aria-activedescendant', prevOption.id);
    }
    options.forEach((o) => o.classList.remove('item-suggestion-option--focused'));
    prevOption.classList.add('item-suggestion-option--focused');
    prevOption.scrollIntoView({ block: 'nearest' });
    return true;
  }

  if (event.key === 'Enter' && activeIndex >= 0) {
    event.preventDefault();
    const activeOption = options[activeIndex];
    const itemId = Number(activeOption.dataset.itemId);
    const item = findItemById ? findItemById(itemId) : null;
    if (item) {
      onSelectItem(item);
    }
    return true;
  }

  if (event.key === 'Escape') {
    if (itemSuggestions instanceof HTMLElement) {
      itemSuggestions.hidden = true;
    }
    if (itemNameInput instanceof HTMLInputElement) {
      itemNameInput.setAttribute('aria-expanded', 'false');
      itemNameInput.removeAttribute('aria-activedescendant');
    }
    return true;
  }

  return false;
}
