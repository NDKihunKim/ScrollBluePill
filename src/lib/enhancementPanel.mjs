import { formatScrollStatLine, statLabelByKey } from './scrollState.mjs';
import { createEnhancementState, applyScroll, revertToSlot, resetState, computeAccumulatedStats, computeAppliedScrollCount, computeRemainingSlots, computeGradeColor } from './enhancementState.mjs';
import { initMakerPanel } from './makerPanel.mjs';
import { buildItemIconUrl } from './maplestoryIo.mjs';

export function initEnhancementPanel(renderEnhancedItemCard) {
  const enhancementPanel = document.querySelector('[data-enhancement-panel]');
  const enhancementDormant = enhancementPanel?.querySelector('[data-enhancement-dormant]');
  const enhancementActive = enhancementPanel?.querySelector('[data-enhancement-active]');
  const enhancementEquipmentKind = enhancementPanel?.querySelector('[data-enhancement-equipment-kind]');
  const slotCheckpointRow = enhancementPanel?.querySelector('[data-slot-checkpoint-row]');
  const scrollDetailPopup = enhancementPanel?.querySelector('[data-scroll-detail-popup]');
  const scrollDetailName = enhancementPanel?.querySelector('[data-scroll-detail-name]');
  const scrollDetailStat = enhancementPanel?.querySelector('[data-scroll-detail-stat]');
  const resetButton = enhancementPanel?.querySelector('[data-enhancement-reset]');
  const scrollList = enhancementPanel?.querySelector('[data-scroll-list]');
  const enhancementMessage = enhancementPanel?.querySelector('[data-enhancement-message]');
  const makerSection = enhancementPanel?.querySelector('[data-maker-section]');
  const makerToggle = enhancementPanel?.querySelector('[data-maker-toggle]');
  const makerGemArea = enhancementPanel?.querySelector('[data-maker-gem-area]');
  const makerGemSlots = enhancementPanel?.querySelector('[data-maker-gem-slots]');
  const makerPicker = enhancementPanel?.querySelector('[data-maker-picker]');
  const makerPickerLabel = enhancementPanel?.querySelector('[data-maker-picker-label]');
  const makerPickerGrid = enhancementPanel?.querySelector('[data-maker-picker-grid]');
  const makerPickerBack = enhancementPanel?.querySelector('[data-maker-picker-back]');

  const makerPanel = initMakerPanel({
    makerSection,
    makerToggle,
    makerGemArea,
    makerGemSlots,
    makerPicker,
    makerPickerLabel,
    makerPickerGrid,
    makerPickerBack,
    renderEnhancedItemCard,
  });

  let scrollIndex = [];
  let scrollsByEquipmentKind = new Map();
  let enhancementState = null;
  let selectedBaseItem = null;

  // Internal keys that are item metadata, not stats chaos can modify
  const NON_STAT_KEYS = new Set(['upgradeSlots', 'attackSpeed']);

  // Chaos scroll state
  let chaosStepperValues = new Map();   // statKey → number (-5..5)
  let activeChaosScroll = null;          // the chaos scroll definition currently expanded
  let activeChaosOptionEl = null;        // the DOM element of the expanded scroll option

  const showEnhancementDormant = () => {
    if (!(enhancementPanel instanceof HTMLElement) ||
        !(enhancementDormant instanceof HTMLElement) ||
        !(enhancementActive instanceof HTMLElement)) {
      return;
    }

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = false;
    enhancementActive.hidden = true;
  };

  const showEnhancementError = (message) => {
    if (!(enhancementPanel instanceof HTMLElement) ||
        !(enhancementDormant instanceof HTMLElement) ||
        !(enhancementActive instanceof HTMLElement)) {
      return;
    }

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = true;
    enhancementActive.hidden = true;

    if (enhancementMessage instanceof HTMLElement) {
      enhancementMessage.textContent = message;
      enhancementMessage.hidden = false;
    }
  };

  const renderSlotRow = () => {
    if (!(slotCheckpointRow instanceof HTMLElement) || !enhancementState) {
      return;
    }

    slotCheckpointRow.replaceChildren();

    for (let i = 0; i < enhancementState.scrollState.slotCount; i++) {
      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'slot-box';
      box.textContent = String(i + 1);

      const scroll = enhancementState.scrollState.slots[i];
      const isCurrent = i === enhancementState.scrollState.currentSlot;

      if (scroll) {
        box.classList.add('slot-box--filled');
      }

      if (isCurrent) {
        box.classList.add('slot-box--current');
      }

      if (scroll || isCurrent) {
        box.addEventListener('click', () => {
          if (scroll) {
            collapseChaosPanel();
            revertToSlot(enhancementState, i);
            renderSlotRow();
            showScrollDetail(scroll);
            refreshEnhancedCard();
          }
        });
      }

      slotCheckpointRow.append(box);
    }
  };

  const showScrollDetail = (scroll) => {
    if (!(scrollDetailPopup instanceof HTMLElement) ||
        !(scrollDetailName instanceof HTMLElement) ||
        !(scrollDetailStat instanceof HTMLElement)) {
      return;
    }

    if (!scroll) {
      scrollDetailPopup.hidden = true;
      return;
    }

    scrollDetailName.textContent = scroll.nameKo;
    scrollDetailStat.textContent = formatScrollStatLine(scroll);
    scrollDetailPopup.hidden = false;
  };

  const hideScrollDetail = () => {
    if (scrollDetailPopup instanceof HTMLElement) {
      scrollDetailPopup.hidden = true;
    }
  };

  const getCurrentStatKeys = () => {
    if (!selectedBaseItem || !enhancementState) {
      return [];
    }

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    return Object.keys(accumulatedStats)
      .filter((key) => !NON_STAT_KEYS.has(key))
      .filter((key) => Number.isFinite(accumulatedStats[key]));
  };

  const collapseChaosPanel = () => {
    if (activeChaosOptionEl) {
      const existingPanel = activeChaosOptionEl.querySelector('.chaos-input-panel');
      if (existingPanel) {
        existingPanel.remove();
      }
      activeChaosOptionEl = null;
    }
    activeChaosScroll = null;
  };

  const updateChaosStepperDisplay = (rowEl, key) => {
    const valueDisplay = rowEl.querySelector('.chaos-stepper-value');
    if (!valueDisplay) return;
    const value = chaosStepperValues.get(key) ?? 0;
    if (value > 0) {
      valueDisplay.textContent = `+${value}`;
    } else {
      valueDisplay.textContent = String(value);
    }
  };

  const renderChaosInputPanel = (optionEl) => {
    if (!activeChaosScroll || !enhancementState) {
      return;
    }

    // Remove any existing panel
    const existingPanel = optionEl.querySelector('.chaos-input-panel');
    if (existingPanel) {
      existingPanel.remove();
    }

    const panel = document.createElement('div');
    panel.className = 'chaos-input-panel';
    // Prevent clicks inside the panel from bubbling to the scroll-option button
    panel.addEventListener('click', (e) => e.stopPropagation());

    const statKeys = getCurrentStatKeys();

    if (statKeys.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'chaos-empty-message';
      msg.textContent = '적용할 스탯이 없습니다';
      panel.append(msg);
      optionEl.append(panel);
      return;
    }

    // Create stepper rows
    statKeys.forEach((key) => {
      const currentValue = chaosStepperValues.get(key) ?? 0;

      const row = document.createElement('div');
      row.className = 'chaos-stat-row';

      const label = document.createElement('span');
      label.className = 'chaos-stat-label';
      label.textContent = statLabelByKey[key] ?? key;

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'chaos-stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        const cur = chaosStepperValues.get(key) ?? 0;
        if (cur > -5) {
          chaosStepperValues.set(key, cur - 1);
          updateChaosStepperDisplay(row, key);
        }
      });

      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'chaos-stepper-value';
      valueDisplay.dataset.chaosStatKey = key;
      // Set initial text directly — updateChaosStepperDisplay uses
      // querySelector which can't find this element before it's in the DOM
      const initialVal = chaosStepperValues.get(key) ?? 0;
      valueDisplay.textContent = initialVal > 0 ? `+${initialVal}` : String(initialVal);

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'chaos-stepper-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        const cur = chaosStepperValues.get(key) ?? 0;
        if (cur < 5) {
          chaosStepperValues.set(key, cur + 1);
          updateChaosStepperDisplay(row, key);
        }
      });

      row.append(label, minusBtn, valueDisplay, plusBtn);
      panel.append(row);
    });

    // 적용 button
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'chaos-apply-button';
    applyBtn.textContent = '적용';

    const remaining = computeRemainingSlots(enhancementState);
    if (remaining <= 0) {
      applyBtn.disabled = true;
    }

    applyBtn.addEventListener('click', () => {
      if (!enhancementState || !activeChaosScroll) {
        return;
      }

      // Build stats object from non-zero deltas
      const stats = {};
      for (const [key, value] of chaosStepperValues.entries()) {
        if (value !== 0 && Number.isFinite(value)) {
          stats[key] = value;
        }
      }

      // If all deltas are 0, do nothing
      if (Object.keys(stats).length === 0) {
        return;
      }

      // Create a scroll entry with user-provided stats
      const scrollEntry = {
        id: activeChaosScroll.id,
        nameKo: activeChaosScroll.nameKo,
        equipmentKind: activeChaosScroll.equipmentKind,
        behavior_type: 'chaos',
        stats,
      };

      const applied = applyScroll(enhancementState, scrollEntry);
      if (!applied) {
        return;
      }

      hideScrollDetail();
      renderSlotRow();
      refreshEnhancedCard();

      // Re-render the chaos panel to include any new stats
      renderChaosInputPanel(optionEl);

      // Disable 적용 button if no more slots
      const newRemaining = computeRemainingSlots(enhancementState);
      if (newRemaining <= 0) {
        const btn = optionEl.querySelector('.chaos-apply-button');
        if (btn) {
          btn.disabled = true;
        }
      }
    });

    panel.append(applyBtn);
    optionEl.append(panel);
  };

  const renderScrollList = (equipmentKind) => {
    if (!(scrollList instanceof HTMLElement) || !(enhancementMessage instanceof HTMLElement)) {
      return;
    }

    scrollList.replaceChildren();
    enhancementMessage.hidden = true;

    const scrolls = scrollsByEquipmentKind.get(equipmentKind) ?? [];

    if (scrolls.length === 0) {
      enhancementMessage.textContent = '이 장비 종류에 해당하는 주문서가 없습니다';
      enhancementMessage.hidden = false;
      return;
    }

    scrollList.hidden = false;

    scrolls.forEach((scroll) => {
      const isChaos = scroll.behavior_type === 'chaos';
      // Use <div> for chaos scrolls — <button> is a replaced element and
      // its box won't expand to contain grid children (the input panel).
      const option = document.createElement(isChaos ? 'div' : 'button');
      if (!isChaos) {
        option.type = 'button';
      } else {
        option.setAttribute('role', 'button');
        option.setAttribute('tabindex', '0');
      }
      option.className = 'scroll-option';

      const icon = document.createElement('img');
      icon.className = 'scroll-option-icon';
      icon.src = buildItemIconUrl(scroll.id);
      icon.alt = '';
      icon.loading = 'lazy';

      const text = document.createElement('span');
      text.className = 'scroll-option-text';

      const name = document.createElement('span');
      name.className = 'scroll-option-name';
      name.textContent = scroll.nameKo;

      const stat = document.createElement('span');
      stat.className = 'scroll-option-stat';
      stat.textContent = formatScrollStatLine(scroll);

      text.append(name, stat);
      option.append(icon, text);

      option.addEventListener('click', (event) => {
        if (!enhancementState || !selectedBaseItem) {
          return;
        }

        // Ignore clicks that originated inside the chaos input panel
        // (steppers, 적용 button, labels, empty space) — those are
        // handled by their own listeners and should not re-init the panel.
        if (event.target.closest('.chaos-input-panel')) {
          return;
        }

        if (scroll.behavior_type === 'chaos') {
          // Save existing stepper values so they survive a re-expand
          const savedValues = new Map(chaosStepperValues);

          // Collapse any existing chaos panel first
          collapseChaosPanel();

          // Set this as the active chaos scroll
          activeChaosScroll = scroll;
          activeChaosOptionEl = option;

          // Initialize stepper values: restore saved values for keys
          // that still exist, default new keys to 0
          const statKeys = getCurrentStatKeys();
          chaosStepperValues = new Map();
          statKeys.forEach((key) => {
            chaosStepperValues.set(key, savedValues.has(key) ? savedValues.get(key) : 0);
          });

          // Render the chaos input panel
          renderChaosInputPanel(option);
          return;
        }

        // Non-chaos scroll: collapse chaos panel and apply normally
        collapseChaosPanel();

        const applied = applyScroll(enhancementState, scroll);
        if (!applied) {
          return;
        }

        hideScrollDetail();
        renderSlotRow();
        refreshEnhancedCard();
      });

      // For chaos scroll <div role="button">, add keyboard support
      if (isChaos) {
        option.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            option.click();
          }
        });
      }

      scrollList.append(option);
    });
  };

  const refreshEnhancedCard = () => {
    if (!selectedBaseItem || !enhancementState) {
      return;
    }

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    const remaining = computeRemainingSlots(enhancementState);
    const appliedCount = computeAppliedScrollCount(enhancementState);
    const gradeColor = computeGradeColor(enhancementState);

    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor);
  };

  const activatePanel2 = (item) => {
    if (!(enhancementPanel instanceof HTMLElement) ||
        !(enhancementDormant instanceof HTMLElement) ||
        !(enhancementActive instanceof HTMLElement) ||
        !(enhancementEquipmentKind instanceof HTMLElement)) {
      return;
    }

    const upgradeSlots = item.stats?.upgradeSlots ?? 0;

    if (upgradeSlots <= 0 || !Number.isFinite(upgradeSlots)) {
      enhancementPanel.hidden = false;
      enhancementDormant.hidden = true;
      enhancementActive.hidden = true;

      if (enhancementMessage instanceof HTMLElement) {
        enhancementMessage.textContent = '강화 불가능한 아이템입니다';
        enhancementMessage.hidden = false;
      }
      makerPanel.deactivate();
      return;
    }

    selectedBaseItem = item;
    enhancementState = createEnhancementState(upgradeSlots, item.requiredLevel ?? 0);
    collapseChaosPanel();
    chaosStepperValues = new Map();

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = true;
    enhancementActive.hidden = false;
    enhancementEquipmentKind.textContent = item.equipmentKind;

    hideScrollDetail();
    renderSlotRow();
    renderScrollList(item.equipmentKind);
    makerPanel.activate(enhancementState, item);
    refreshEnhancedCard();
  };

  resetButton?.addEventListener('click', () => {
    if (!enhancementState || !selectedBaseItem) {
      return;
    }

    resetState(enhancementState);
    collapseChaosPanel();
    chaosStepperValues = new Map();
    hideScrollDetail();
    renderSlotRow();
    makerPanel.resetMakerUI();
    refreshEnhancedCard();
  });

  const sortScrollList = (list) => {
    const STAT_KEY_RANK = {
      weaponAttack: 0,
      magicAttack: 1,
      str: 2,
      dex: 3,
      int: 4,
      luk: 5,
    };

    const getStatPriority = (stats) => {
      const keys = Object.keys(stats ?? {});
      let best = 99;
      for (const key of keys) {
        const rank = STAT_KEY_RANK[key];
        if (rank !== undefined && rank < best) best = rank;
      }
      return best;
    };

    const stemName = (n) => String(n ?? '').replace(/(\d+)%$/, '').trimEnd();

    const percentPattern = /(\d+)%$/;
    const extractPercent = (name) => {
      const match = name?.match(percentPattern);
      return match ? Number(match[1]) : 0;
    };

    // Split chaos and non-chaos; sort non-chaos normally, append chaos at end
    const nonChaos = [];
    const chaos = [];
    for (const s of list) {
      if (s.behavior_type === 'chaos') {
        chaos.push(s);
      } else {
        nonChaos.push(s);
      }
    }

    nonChaos.sort((a, b) =>
      getStatPriority(a.stats) - getStatPriority(b.stats) ||
      stemName(a.nameKo).localeCompare(stemName(b.nameKo), 'ko-KR') ||
      extractPercent(b.nameKo) - extractPercent(a.nameKo),
    );

    // Replace list contents: sorted non-chaos, then chaos at end
    list.length = 0;
    list.push(...nonChaos, ...chaos);
  };

  Promise.all([
    fetch('/data/scrolls-gms83-ko.json').then((r) => {
      if (!r.ok) throw new Error(`Unable to load scroll index: ${r.status}`);
      return r.json();
    }),
    fetch('/data/scroll-overrides.local.json').then((r) => {
      if (!r.ok) {
        // Overrides file is optional — 404 is fine
        return [];
      }
      return r.json();
    }).catch(() => []),
  ])
    .then(([scrolls, overrides]) => {
      scrollIndex = Array.isArray(scrolls) ? scrolls : [];
      const overrideList = Array.isArray(overrides) ? overrides : [];
      scrollsByEquipmentKind = new Map();

      // Build equipment kind lists from main scroll index
      scrollIndex.forEach((scroll) => {
        const kind = scroll.equipmentKind;
        if (!scrollsByEquipmentKind.has(kind)) {
          scrollsByEquipmentKind.set(kind, []);
        }
        scrollsByEquipmentKind.get(kind).push(scroll);
      });

      // Merge wildcard overrides (equipmentKind: "*") into every kind
      const wildcardOverrides = overrideList.filter((s) => s.equipmentKind === '*');
      if (wildcardOverrides.length > 0) {
        const allKinds = [...scrollsByEquipmentKind.keys()];
        allKinds.forEach((kind) => {
          wildcardOverrides.forEach((override) => {
            scrollsByEquipmentKind.get(kind).push({ ...override, equipmentKind: kind });
          });
        });
      }

      // Merge non-wildcard overrides into their specific kind
      overrideList
        .filter((s) => s.equipmentKind !== '*')
        .forEach((override) => {
          const kind = override.equipmentKind;
          if (!scrollsByEquipmentKind.has(kind)) {
            scrollsByEquipmentKind.set(kind, []);
          }
          scrollsByEquipmentKind.get(kind).push(override);
        });

      // Sort each equipment kind's list (chaos always at end)
      for (const list of scrollsByEquipmentKind.values()) {
        sortScrollList(list);
      }
    })
    .catch((error) => {
      console.error(error);
      showEnhancementError('주문서 데이터를 불러오지 못했습니다');
    });

  showEnhancementDormant();

  return activatePanel2;
}
