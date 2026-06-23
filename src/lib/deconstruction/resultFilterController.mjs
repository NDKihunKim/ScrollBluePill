import {
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getFacetOptions,
  getVisibleStrategyIndexes,
} from './resultFilters.mjs';
import { buildItemIconUrl } from '../maplestoryIo.mjs';
import { GEM_GRADES, GEM_ITEM_IDS, statLabelByKey } from '../makerData.mjs';
import { HP_MP_KEYS } from '../enhancementState.mjs';

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
  let stimulantRanges = new Map();
  let itemLevelUpRanges = new Map();

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
    const hasStimRanges = stimulantRanges.size > 0;
    const hasLevelRanges = itemLevelUpRanges.size > 0;
    const visibleIndexes = new Set(getVisibleStrategyIndexes(
      model, selections,
      hasStimRanges ? stimulantRanges : null,
      hasLevelRanges ? itemLevelUpRanges : null,
    ));
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
    // Stimulant panel manages its own state via sliders — skip
    if (activePanelSource === 'stimulant') return;
    if (activePanelSource === 'itemLevelUp') return;
    // Re-render the panel for the active source
    renderPanel(activePanelSource);
  };

  const setSecondaryOption = (source, key, checked) => {
    const selected = selections.get(source);
    if (!selected) return;
    if (checked) selected.add(key);
    else selected.delete(key);
    applyFilters();
    refreshActivePanel();
  };

  const renderScrollPanel = (options, selected) => {
    secondaryContainer.replaceChildren();
    const list = document.createElement('div');
    list.className = 'decon-secondary-scroll-list';

    for (const option of options) {
      const label = document.createElement('label');
      label.className = 'decon-secondary-scroll-row';
      label.classList.toggle('decon-secondary-scroll-row--unavailable', !option.available);

      const input = document.createElement('input');
      input.type = 'checkbox';
      input.checked = selected.has(option.key);
      input.disabled = !option.available;
      input.addEventListener('change', () => {
        setSecondaryOption('scrolls', option.key, input.checked);
      });

      const icon = document.createElement('img');
      icon.className = 'decon-secondary-scroll-icon';
      icon.src = buildItemIconUrl(option.iconId);
      icon.alt = option.label;
      icon.loading = 'lazy';
      icon.addEventListener('error', () => { icon.hidden = true; });

      const text = document.createElement('span');
      text.textContent = option.label;

      label.append(input, icon, text);
      list.append(label);
    }

    secondaryContainer.append(list);
    secondaryContainer.hidden = false;
  };

  const renderGemPanel = (options, selected) => {
    const categories = new Map();
    for (const option of options) {
      const gemKey = option.gemKey;
      if (!categories.has(gemKey)) {
        categories.set(gemKey, {
          gemKey,
          nameKo: option.label.replace(/\s(상급|중급|하급)$/, ''),
          iconId: GEM_ITEM_IDS[gemKey]?.base ?? 0,
          grades: [],
        });
      }
      categories.get(gemKey).grades.push(option);
    }

    const showCategories = () => {
      secondaryContainer.replaceChildren();
      const label = document.createElement('div');
      label.className = 'decon-secondary-gem-label';
      label.textContent = '보석 종류 선택';
      secondaryContainer.append(label);

      const grid = document.createElement('div');
      grid.className = 'decon-secondary-gem-grid';

      for (const cat of categories.values()) {
        const item = document.createElement('div');
        item.className = 'decon-secondary-gem-category';

        const icon = document.createElement('img');
        icon.src = buildItemIconUrl(cat.iconId);
        icon.alt = cat.nameKo;
        icon.loading = 'lazy';
        icon.addEventListener('error', () => { icon.hidden = true; });

        const name = document.createElement('span');
        name.textContent = cat.nameKo;

        item.append(icon, name);
        item.addEventListener('click', () => showGrades(cat));
        grid.append(item);
      }

      secondaryContainer.append(grid);
      secondaryContainer.hidden = false;
    };

    const showGrades = (cat) => {
      secondaryContainer.replaceChildren();

      const header = document.createElement('div');
      header.className = 'decon-secondary-gem-header';

      const backBtn = document.createElement('button');
      backBtn.type = 'button';
      backBtn.className = 'decon-secondary-gem-back';
      backBtn.textContent = '← 뒤로';
      backBtn.addEventListener('click', showCategories);

      const icon = document.createElement('img');
      icon.src = buildItemIconUrl(cat.iconId);
      icon.alt = cat.nameKo;
      icon.loading = 'lazy';
      icon.addEventListener('error', () => { icon.hidden = true; });

      const name = document.createElement('span');
      name.className = 'decon-secondary-gem-name';
      name.textContent = cat.nameKo;

      header.append(backBtn, icon, name);

      const gradeList = document.createElement('div');
      gradeList.className = 'decon-secondary-gem-grades';

      for (const gradeOpt of cat.grades) {
        const gradeLabel = document.createElement('label');
        gradeLabel.className = 'decon-secondary-gem-grade';
        if (!gradeOpt.available) {
          gradeLabel.classList.add('decon-secondary-gem-grade--unavailable');
        }

        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = selected.has(gradeOpt.key);
        input.disabled = !gradeOpt.available;
        input.addEventListener('change', () => {
          setSecondaryOption('gems', gradeOpt.key, input.checked);
        });

        const gradeIcon = document.createElement('img');
        const gradeKey = gradeOpt.gradeIndex === 0 ? 'low' : gradeOpt.gradeIndex === 1 ? 'mid' : 'high';
        const gradeIconId = GEM_ITEM_IDS[cat.gemKey]?.[gradeKey] ?? 0;
        gradeIcon.src = buildItemIconUrl(gradeIconId);
        gradeIcon.alt = GEM_GRADES[gradeOpt.gradeIndex] ?? '';
        gradeIcon.loading = 'lazy';
        gradeIcon.addEventListener('error', () => { gradeIcon.hidden = true; });

        const gradeText = document.createElement('span');
        gradeText.textContent = GEM_GRADES[gradeOpt.gradeIndex] ?? '';

        gradeLabel.append(input, gradeIcon, gradeText);
        gradeList.append(gradeLabel);
      }

      secondaryContainer.append(header, gradeList);
      secondaryContainer.hidden = false;
    };

    showCategories();
  };

  const renderStimulantPanel = (options) => {
    secondaryContainer.replaceChildren();

    const statRange = new Map();
    for (const option of options) {
      if (option.key === 'stimulant:none') continue;
      const stats = option.stats;
      if (!stats) continue;
      for (const [key, value] of Object.entries(stats)) {
        if (!Number.isFinite(value)) continue;
        if (!statRange.has(key)) {
          statRange.set(key, { min: value, max: value });
        } else {
          const r = statRange.get(key);
          r.min = Math.min(r.min, value);
          r.max = Math.max(r.max, value);
        }
      }
    }

    if (statRange.size === 0) {
      secondaryContainer.hidden = true;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'decon-secondary-stimulant';

    for (const [key, fullRange] of statRange) {
      const limit = HP_MP_KEYS.has(key) ? 50 : 5;
      const absMin = Math.max(-limit, fullRange.min);
      const absMax = Math.min(limit, fullRange.max);

      if (!stimulantRanges.has(key)) {
        stimulantRanges.set(key, { min: absMin, max: absMax });
      }
      const currentRange = stimulantRanges.get(key);

      const row = document.createElement('div');
      row.className = 'decon-secondary-stimulant-row';

      const label = document.createElement('span');
      label.className = 'decon-secondary-stimulant-stat';
      label.textContent = statLabelByKey[key] ?? key;

      const minSlider = document.createElement('input');
      minSlider.type = 'range';
      minSlider.min = absMin;
      minSlider.max = absMax;
      minSlider.value = currentRange.min;
      minSlider.className = 'decon-secondary-stimulant-slider';

      const minVal = document.createElement('span');
      minVal.className = 'decon-secondary-stimulant-value';
      minVal.textContent = String(currentRange.min);

      const sep = document.createElement('span');
      sep.className = 'decon-secondary-stimulant-sep';
      sep.textContent = '–';

      const maxVal = document.createElement('span');
      maxVal.className = 'decon-secondary-stimulant-value';
      maxVal.textContent = String(currentRange.max);

      const maxSlider = document.createElement('input');
      maxSlider.type = 'range';
      maxSlider.min = absMin;
      maxSlider.max = absMax;
      maxSlider.value = currentRange.max;
      maxSlider.className = 'decon-secondary-stimulant-slider';

      const updateRange = () => {
        let mn = Number(minSlider.value);
        let mx = Number(maxSlider.value);
        if (mn > mx) [mn, mx] = [mx, mn];
        stimulantRanges.set(key, { min: mn, max: mx });
        minSlider.value = mn;
        maxSlider.value = mx;
        minVal.textContent = String(mn);
        maxVal.textContent = String(mx);
        applyFilters();
      };

      minSlider.addEventListener('input', updateRange);
      maxSlider.addEventListener('input', updateRange);

      row.append(label, minSlider, minVal, sep, maxVal, maxSlider);
      wrapper.append(row);
    }

    secondaryContainer.append(wrapper);
    secondaryContainer.hidden = false;
  };

  const renderItemLevelUpPanel = (options) => {
    secondaryContainer.replaceChildren();

    const statRange = new Map();
    for (const option of options) {
      const stats = option.stats;
      if (!stats) continue;
      for (const [key, value] of Object.entries(stats)) {
        if (!Number.isFinite(value)) continue;
        if (!statRange.has(key)) {
          statRange.set(key, { min: value, max: value });
        } else {
          const r = statRange.get(key);
          r.min = Math.min(r.min, value);
          r.max = Math.max(r.max, value);
        }
      }
    }

    if (statRange.size === 0) {
      secondaryContainer.hidden = true;
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'decon-secondary-stimulant';

    for (const [key, fullRange] of statRange) {
      const limit = HP_MP_KEYS.has(key) ? 50 : 5;
      const absMin = Math.max(-limit, fullRange.min);
      const absMax = Math.min(limit, fullRange.max);

      if (!itemLevelUpRanges.has(key)) {
        itemLevelUpRanges.set(key, { min: absMin, max: absMax });
      }
      const currentRange = itemLevelUpRanges.get(key);

      const row = document.createElement('div');
      row.className = 'decon-secondary-stimulant-row';

      const label = document.createElement('span');
      label.className = 'decon-secondary-stimulant-stat';
      label.textContent = statLabelByKey[key] ?? key;

      const minSlider = document.createElement('input');
      minSlider.type = 'range';
      minSlider.min = absMin;
      minSlider.max = absMax;
      minSlider.value = currentRange.min;
      minSlider.className = 'decon-secondary-stimulant-slider';

      const minVal = document.createElement('span');
      minVal.className = 'decon-secondary-stimulant-value';
      minVal.textContent = String(currentRange.min);

      const sep = document.createElement('span');
      sep.className = 'decon-secondary-stimulant-sep';
      sep.textContent = '–';

      const maxVal = document.createElement('span');
      maxVal.className = 'decon-secondary-stimulant-value';
      maxVal.textContent = String(currentRange.max);

      const maxSlider = document.createElement('input');
      maxSlider.type = 'range';
      maxSlider.min = absMin;
      maxSlider.max = absMax;
      maxSlider.value = currentRange.max;
      maxSlider.className = 'decon-secondary-stimulant-slider';

      const updateRange = () => {
        let mn = Number(minSlider.value);
        let mx = Number(maxSlider.value);
        if (mn > mx) [mn, mx] = [mx, mn];
        itemLevelUpRanges.set(key, { min: mn, max: mx });
        minSlider.value = mn;
        maxSlider.value = mx;
        minVal.textContent = String(mn);
        maxVal.textContent = String(mx);
        applyFilters();
      };

      minSlider.addEventListener('input', updateRange);
      maxSlider.addEventListener('input', updateRange);

      row.append(label, minSlider, minVal, sep, maxVal, maxSlider);
      wrapper.append(row);
    }

    secondaryContainer.append(wrapper);
    secondaryContainer.hidden = false;
  };

  const renderPanel = (source) => {
    if (!model) return;
    const options = getFacetOptions(model, selections, source);
    if (options.length === 0) {
      hidePanel();
      return;
    }
    const selected = selections.get(source) ?? new Set();

    if (source === 'scrolls') {
      renderScrollPanel(options, selected);
    } else if (source === 'gems') {
      renderGemPanel(options, selected);
    } else if (source === 'stimulant') {
      renderStimulantPanel(options);
    } else if (source === 'itemLevelUp') {
      renderItemLevelUpPanel(options);
    } else {
      secondaryContainer.replaceChildren();
      const list = document.createElement('div');
      list.className = 'decon-secondary-checkboxes';
      for (const option of options) {
        const label = document.createElement('label');
        label.className = 'decon-secondary-checkbox';
        label.classList.toggle('decon-secondary-checkbox--unavailable', !option.available);
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
      secondaryContainer.append(list);
      secondaryContainer.hidden = false;
    }
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
    stimulantRanges = new Map();
    itemLevelUpRanges = new Map();
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
