import {
  buildSecondaryFilterModel,
  createInitialSecondarySelections,
  getFacetOptions,
  getVisibleStrategyIndexes,
} from './resultFilters.mjs';
import { buildItemIconUrl } from '../maplestoryIo.mjs';
import { GEM_GRADES, GEM_ITEM_IDS, statLabelByKey, STAT_KEY_RANK } from '../makerData.mjs';
import { HP_MP_KEYS } from '../enhancementState.mjs';
import { formatScrollStatLine } from '../scrollState.mjs';

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
  let scrollCountRanges = new Map();
  let chaosDeltaRanges = new Map();
  let activeScrollStatFilter = 'all';

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
    const hasCountRanges = scrollCountRanges.size > 0;
    const hasChaosRanges = chaosDeltaRanges.size > 0;
    const visibleIndexes = new Set(getVisibleStrategyIndexes(
      model, selections,
      hasStimRanges ? stimulantRanges : null,
      hasLevelRanges ? itemLevelUpRanges : null,
      hasCountRanges ? scrollCountRanges : null,
      hasChaosRanges ? chaosDeltaRanges : null,
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
    if (checked) {
      selected.add(key);
    } else {
      selected.delete(key);
      // Clear any count range when toggled off so it doesn't
      // silently filter strategies that don't use this scroll.
      if (source === 'scrolls') scrollCountRanges.delete(key);
    }
    applyFilters();
    refreshActivePanel();
  };

  const renderScrollStatFilters = (options) => {
    // Collect unique stat keys from all scroll options, sorted by STAT_KEY_RANK priority
    const statKeys = [...new Set(options.flatMap((o) => o.statKeys ?? []))]
      .sort((a, b) => (STAT_KEY_RANK[a] ?? 999) - (STAT_KEY_RANK[b] ?? 999));

    if (statKeys.length === 0) return;

    const filtersRow = document.createElement('div');
    filtersRow.className = 'decon-secondary-scroll-filters';

    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'decon-secondary-scroll-filter';
    allBtn.textContent = '전체';
    allBtn.setAttribute('aria-pressed', String(activeScrollStatFilter === 'all'));
    if (activeScrollStatFilter === 'all') {
      allBtn.classList.add('decon-secondary-scroll-filter--active');
    }
    allBtn.addEventListener('click', () => {
      activeScrollStatFilter = 'all';
      renderPanel('scrolls');
    });
    filtersRow.append(allBtn);

    for (const key of statKeys) {
      const label = statLabelByKey[key] ?? key;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'decon-secondary-scroll-filter';
      btn.textContent = label;
      btn.setAttribute('aria-pressed', String(activeScrollStatFilter === key));
      if (activeScrollStatFilter === key) {
        btn.classList.add('decon-secondary-scroll-filter--active');
      }
      btn.addEventListener('click', () => {
        activeScrollStatFilter = key;
        renderPanel('scrolls');
      });
      filtersRow.append(btn);
    }

    secondaryContainer.append(filtersRow);
  };

  const renderScrollPanel = (options, selected) => {
    secondaryContainer.replaceChildren();

    // Stat filter tabs (visual filter only)
    renderScrollStatFilters(options);

    // Filter scrolls by active stat filter
    const visibleOptions = activeScrollStatFilter === 'all'
      ? options
      : options.filter((o) => (o.statKeys ?? []).includes(activeScrollStatFilter));

    const list = document.createElement('div');
    list.className = 'decon-secondary-scroll-list';

    // Compute max count per scroll across all model entries
    const maxCounts = new Map();
    if (model) {
      for (const entry of model.entries) {
        for (const [scrollKey, count] of (entry.scrollCounts ?? [])) {
          const prev = maxCounts.get(scrollKey) ?? 0;
          if (count > prev) maxCounts.set(scrollKey, count);
        }
      }
    }

    // Compute per-stat delta ranges for chaos scrolls across all entries
    const chaosStatRanges = new Map(); // scroll:{id} → Map<statKey, {min,max}>
    if (model) {
      for (const entry of model.entries) {
        for (const s of (entry.strategy.scrolls ?? [])) {
          if (s.behavior_type !== 'chaos') continue;
          const key = `scroll:${s.id}`;
          if (!chaosStatRanges.has(key)) chaosStatRanges.set(key, new Map());
          const statMap = chaosStatRanges.get(key);
          for (const [k, v] of Object.entries(s.stats ?? {})) {
            if (!Number.isFinite(v)) continue;
            const existing = statMap.get(k);
            statMap.set(k, {
              min: Math.min(existing?.min ?? Infinity, v),
              max: Math.max(existing?.max ?? -Infinity, v),
            });
          }
        }
      }
    }

    for (const option of visibleOptions) {
      const isSelected = selected.has(option.key);
      const isAvailable = option.available;
      const isChaos = option.behaviorType === 'chaos';

      // Build the toggle row as a <div> (not <button>) because it contains
      // interactive <input type="range"> sliders — nesting interactive content
      // inside a <button> is invalid HTML and causes browsers to strip or hide
      // the slider elements.
      const row = document.createElement('div');
      row.className = 'decon-secondary-scroll-row';
      if (isSelected) row.classList.add('decon-secondary-scroll-row--selected');
      if (!isAvailable) row.classList.add('decon-secondary-scroll-row--unavailable');
      row.setAttribute('role', 'button');
      row.setAttribute('aria-pressed', String(isSelected));
      row.setAttribute('tabindex', isAvailable ? '0' : '-1');
      if (!isAvailable) row.setAttribute('aria-disabled', 'true');

      const toggleScroll = () => {
        if (!isAvailable) return;
        setSecondaryOption('scrolls', option.key, !selected.has(option.key));
      };

      row.addEventListener('click', toggleScroll);
      row.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          toggleScroll();
        }
      });

      const icon = document.createElement('img');
      icon.className = 'decon-secondary-scroll-icon';
      icon.src = buildItemIconUrl(option.iconId);
      icon.alt = option.label;
      icon.loading = 'lazy';
      icon.addEventListener('error', () => { icon.hidden = true; });

      const textBlock = document.createElement('span');
      textBlock.className = 'decon-secondary-scroll-text';

      const name = document.createElement('span');
      name.className = 'decon-secondary-scroll-name';
      name.textContent = option.label;

      if (!isChaos) {
        const statLine = document.createElement('span');
        statLine.className = 'decon-secondary-scroll-stat';
        statLine.textContent = option.stats ? formatScrollStatLine({ stats: option.stats }) : '';
        textBlock.append(name, statLine);
      } else {
        textBlock.append(name);
      }
      const info = document.createElement('span');
      info.className = 'decon-secondary-scroll-info';
      info.append(icon, textBlock);
      row.append(info);

      // Add sliders: count range for regular, stat delta range for chaos
      if (!isChaos) {
        // ── Regular scroll: count range slider ──
        const maxCount = maxCounts.get(option.key) ?? 0;
        if (maxCount > 0) {
          const sliderWrap = document.createElement('span');
          sliderWrap.className = 'decon-secondary-scroll-slider-wrap';
          if (!isSelected) sliderWrap.classList.add('decon-secondary-scroll-slider-wrap--disabled');

          const countLabel = document.createElement('span');
          countLabel.className = 'decon-secondary-scroll-count-label';
          countLabel.textContent = '주문서 사용 횟수:';

          const existing = scrollCountRanges.get(option.key);
          const currentMin = existing ? existing.min : 0;
          const currentMax = existing ? existing.max : maxCount;

          const minSlider = document.createElement('input');
          minSlider.type = 'range';
          minSlider.min = 0;
          minSlider.max = maxCount;
          minSlider.value = currentMin;
          minSlider.disabled = !isSelected;

          const minVal = document.createElement('span');
          minVal.className = 'decon-secondary-stimulant-value';
          minVal.textContent = String(currentMin);

          const sep = document.createElement('span');
          sep.className = 'decon-secondary-stimulant-sep';
          sep.textContent = '~';

          const maxVal = document.createElement('span');
          maxVal.className = 'decon-secondary-stimulant-value';
          maxVal.textContent = String(currentMax);

          const maxSlider = document.createElement('input');
          maxSlider.type = 'range';
          maxSlider.min = 0;
          maxSlider.max = maxCount;
          maxSlider.value = currentMax;
          maxSlider.disabled = !isSelected;

          const updateCountRange = () => {
            let mn = Number(minSlider.value);
            let mx = Number(maxSlider.value);
            if (mn > mx) [mn, mx] = [mx, mn];
            scrollCountRanges.set(option.key, { min: mn, max: mx });
            minSlider.value = mn;
            maxSlider.value = mx;
            minVal.textContent = String(mn);
            maxVal.textContent = String(mx);
            applyFilters();
          };

          minSlider.addEventListener('input', updateCountRange);
          maxSlider.addEventListener('input', updateCountRange);

          sliderWrap.addEventListener('click', (e) => { e.stopPropagation(); });
          sliderWrap.addEventListener('pointerdown', (e) => { e.stopPropagation(); });

          const dualRange = document.createElement('span');
          dualRange.className = 'dual-range';
          dualRange.append(minSlider, maxSlider);
          const header = document.createElement('span');
          header.className = 'decon-secondary-scroll-slider-header';
          header.append(countLabel, minVal, sep, maxVal);
          sliderWrap.append(header, dualRange);
          row.append(sliderWrap);
        }
      } else {
        // ── Chaos scroll: per-stat delta range sliders ──
        const statRanges = chaosStatRanges.get(option.key);
        if (statRanges && statRanges.size > 0) {
          const chaosWrap = document.createElement('span');
          chaosWrap.className = 'decon-secondary-scroll-chaos-stats';
          if (!isSelected) chaosWrap.classList.add('decon-secondary-scroll-slider-wrap--disabled');

          // Get or init persisted ranges for this scroll key
          let persisted = chaosDeltaRanges.get(option.key);
          if (!persisted) {
            persisted = new Map();
            chaosDeltaRanges.set(option.key, persisted);
          }

          for (const [statKey, fullRange] of statRanges) {
            const existing = persisted.get(statKey);
            const curMin = existing ? existing.min : fullRange.min;
            const curMax = existing ? existing.max : fullRange.max;

            const rowS = document.createElement('span');
            rowS.className = 'decon-secondary-scroll-chaos-stat-row';

            const label = document.createElement('span');
            label.className = 'decon-secondary-stimulant-stat';
            const formatLabel = (mn, mx) =>
              `${statLabelByKey[statKey] ?? statKey} ${mn}~${mx}`;
            label.textContent = formatLabel(curMin, curMax);

            const minSlider = document.createElement('input');
            minSlider.type = 'range';
            minSlider.min = fullRange.min;
            minSlider.max = fullRange.max;
            minSlider.value = curMin;
            minSlider.disabled = !isSelected;

            const maxSlider = document.createElement('input');
            maxSlider.type = 'range';
            maxSlider.min = fullRange.min;
            maxSlider.max = fullRange.max;
            maxSlider.value = curMax;
            maxSlider.disabled = !isSelected;

            const updateDeltaRange = () => {
              let mn = Number(minSlider.value);
              let mx = Number(maxSlider.value);
              if (mn > mx) [mn, mx] = [mx, mn];
              persisted.set(statKey, { min: mn, max: mx });
              minSlider.value = mn;
              maxSlider.value = mx;
              label.textContent = formatLabel(mn, mx);
              applyFilters();
            };

            minSlider.addEventListener('input', updateDeltaRange);
            maxSlider.addEventListener('input', updateDeltaRange);

            const dualRange = document.createElement('span');
            dualRange.className = 'decon-chaos-dual-range';
            dualRange.append(minSlider, maxSlider);
            rowS.append(label, dualRange);
            chaosWrap.append(rowS);
          }

          chaosWrap.addEventListener('click', (e) => { e.stopPropagation(); });
          chaosWrap.addEventListener('pointerdown', (e) => { e.stopPropagation(); });
          row.append(chaosWrap);
        }
      }

      list.append(row);
    }

    secondaryContainer.append(list);
    secondaryContainer.hidden = false;
  };

  let currentGemKey = null; // track which gem's grades are being viewed

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
      currentGemKey = null;
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
      currentGemKey = cat.gemKey;
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

    const previousGemKey = currentGemKey;
    showCategories();

    // If user was viewing a specific gem's grades, restore that view
    if (previousGemKey && categories.has(previousGemKey)) {
      const cat = categories.get(previousGemKey);
      showGrades(cat);
    }
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

      const dualRange = document.createElement('span');
      dualRange.className = 'dual-range';
      dualRange.append(minSlider, maxSlider);
      row.append(label, dualRange, minVal, sep, maxVal);
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

      const dualRange = document.createElement('span');
      dualRange.className = 'dual-range';
      dualRange.append(minSlider, maxSlider);
      row.append(label, dualRange, minVal, sep, maxVal);
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
    scrollCountRanges = new Map();
    chaosDeltaRanges = new Map();
    activeScrollStatFilter = 'all';
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
