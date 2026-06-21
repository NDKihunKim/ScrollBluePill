import {
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getFacetOptions,
  getVisibleStrategyIndexes,
} from './resultFilters.mjs';

const SOURCE_LABELS = {
  scrolls: '주문서',
  stimulant: '촉진제/추옵',
  gems: '보석 (메이커)',
  itemLevelUp: '레벨업',
};

export function createResultFilterController({ root, secondaryContainer }) {
  let activePanelSource = null;
  let model = null;
  let selections = new Map();

  const hidePanel = () => {
    secondaryContainer.replaceChildren();
    secondaryContainer.hidden = true;
  };

  const updatePrimaryState = () => {
    root.querySelectorAll('[data-decon-filter]').forEach((chip) => {
      const chipSource = chip.dataset.deconFilter;
      const active = chipSource === (activePanelSource ?? 'all');
      chip.classList.toggle('decon-filter-chip--active', active);
      chip.setAttribute('aria-pressed', String(active));
    });
  };

  const applyFilters = () => {
    if (!model) return 0;
    const visibleIndexes = new Set(getVisibleStrategyIndexes(model, selections));
    let visibleCount = 0;
    root.querySelectorAll('.decon-strategy-card').forEach((card) => {
      const strategyIndex = Number.parseInt(card.dataset.strategyIndex ?? '', 10);
      const visible = visibleIndexes.has(strategyIndex);
      card.hidden = !visible;
      if (visible) visibleCount++;
    });
    const allChip = root.querySelector('[data-decon-filter="all"]');
    if (allChip) allChip.textContent = `전체 (${visibleCount})`;
    const empty = root.querySelector('[data-decon-filter-empty]');
    if (empty) empty.hidden = visibleCount > 0;
    return visibleCount;
  };

  const refreshActivePanel = () => {
    if (!model || activePanelSource === null) return;
    const list = secondaryContainer.querySelector('.decon-secondary-filter-options');
    if (!list) return;
    const labels = new Map(
      Array.from(list.querySelectorAll('[data-decon-option-key]'))
        .map((label) => [label.dataset.deconOptionKey, label]),
    );
    for (const option of getFacetOptions(model, selections, activePanelSource)) {
      const label = labels.get(option.key);
      if (!label) continue;
      label.classList.toggle(
        'decon-secondary-filter-option--unavailable',
        !option.available,
      );
      const input = label.querySelector('input');
      if (input) {
        input.checked = selections.get(activePanelSource)?.has(option.key) ?? false;
        input.disabled = !option.available;
      }
      list.append(label);
    }
  };

  const setSecondaryOption = (source, key, checked) => {
    const selected = selections.get(source);
    if (!selected) return;
    if (checked) selected.add(key);
    else selected.delete(key);
    applyFilters();
    refreshActivePanel();
  };

  const renderPanel = (source) => {
    if (!model) return;
    const options = getFacetOptions(model, selections, source);
    if (options.length === 0) {
      hidePanel();
      return;
    }

    secondaryContainer.replaceChildren();
    const section = document.createElement('section');
    section.className = 'decon-secondary-filter';
    const heading = document.createElement('h3');
    heading.textContent = SOURCE_LABELS[source];
    const list = document.createElement('div');
    list.className = 'decon-secondary-filter-options';
    const selected = selections.get(source) ?? new Set();

    for (const option of options) {
      const label = document.createElement('label');
      label.className = 'decon-secondary-filter-option';
      label.dataset.deconOptionKey = option.key;
      label.classList.toggle('decon-secondary-filter-option--unavailable', !option.available);
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(option.key);
      input.disabled = !option.available;
      input.addEventListener('change', () => {
        setSecondaryOption(source, option.key, input.checked);
      });
      const text = document.createElement('span');
      text.textContent = option.label;
      label.append(input, text);
      list.append(label);
    }

    section.append(heading, list);
    secondaryContainer.append(section);
    secondaryContainer.hidden = false;
  };

  const setActiveFilter = (source) => {
    activePanelSource = source;
    updatePrimaryState();
    if (source === null) hidePanel();
    else renderPanel(source);
  };

  const reset = () => {
    activePanelSource = null;
    model = null;
    selections = new Map();
    hidePanel();
  };

  const initialize = (strategies) => {
    model = buildSecondaryFilterModel(strategies);
    selections = createInitialSecondarySelections(model);
    root.querySelectorAll('[data-decon-filter]').forEach((chip) => {
      const source = chip.dataset.deconFilter === 'all' ? null : chip.dataset.deconFilter;
      chip.addEventListener('click', () => setActiveFilter(source));
    });
    applyFilters();
    setActiveFilter(null);
  };

  return { initialize, reset, setActiveFilter, setSecondaryOption };
}
