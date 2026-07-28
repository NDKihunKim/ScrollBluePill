import { formatScrollStatLine, statLabelByKey, clearSlot } from './scrollState.mjs';
import {
  createEnhancementState,
  applyScroll,
  revertToSlot,
  resetState,
  computeAccumulatedStats,
  computeStatBreakdown,
  computeItemLevelUpCardMeta,
  computeAppliedScrollCount,
  computeRemainingSlots,
  computeGradeColor,
  HP_MP_KEYS,
} from './enhancementState.mjs';
import { initMakerPanel } from './makerPanel.mjs';
import { initItemLevelUpPanel } from './itemLevelUpPanel.mjs';
import { buildItemIconUrl } from './maplestoryIo.mjs';
import { CHAOS_SCROLL_ICON_ID } from './makerData.mjs';

export function initEnhancementPanel(renderEnhancedItemCard) {
  const enhancementPanel = document.querySelector('[data-enhancement-panel]');
  const enhancementDormant = enhancementPanel?.querySelector('[data-enhancement-dormant]');
  const enhancementActive = enhancementPanel?.querySelector('[data-enhancement-active]');
  const enhancementEquipmentKind = enhancementPanel?.querySelector(
    '[data-enhancement-equipment-kind]',
  );
  const slotCheckpointRow = enhancementPanel?.querySelector('[data-slot-checkpoint-row]');
  const scrollDetailPopup = enhancementPanel?.querySelector('[data-scroll-detail-popup]');
  const scrollDetailName = enhancementPanel?.querySelector('[data-scroll-detail-name]');
  const scrollDetailStat = enhancementPanel?.querySelector('[data-scroll-detail-stat]');
  const resetButton = document.querySelector('[data-enhancement-reset]');
  const scrollList = enhancementPanel?.querySelector('[data-scroll-list]');
  const scrollStatFilters = enhancementPanel?.querySelector('[data-scroll-stat-filters]');
  const enhancementMessage = enhancementPanel?.querySelector('[data-enhancement-message]');
  const enhancementSummary = enhancementPanel?.querySelector('[data-enhancement-summary]');
  const enhancementSummaryStats = enhancementPanel?.querySelector(
    '[data-enhancement-summary-stats]',
  );
  const scrollSection = enhancementPanel?.querySelector('.enhancement-scroll-section');
  const makerSection = enhancementPanel?.querySelector('[data-maker-section]');
  const makerToggle = enhancementPanel?.querySelector('[data-maker-toggle]');
  const makerGemArea = enhancementPanel?.querySelector('[data-maker-gem-area]');
  const makerGemSlots = enhancementPanel?.querySelector('[data-maker-gem-slots]');
  const makerStimulantSlot = enhancementPanel?.querySelector('[data-maker-stimulant-slot]');
  const makerStimulantEditor = enhancementPanel?.querySelector('[data-maker-stimulant-editor]');
  const makerStimulantEditorLabel = enhancementPanel?.querySelector(
    '[data-maker-stimulant-editor-label]',
  );
  const makerStimulantEditorGrid = enhancementPanel?.querySelector(
    '[data-maker-stimulant-editor-grid]',
  );
  const makerPicker = enhancementPanel?.querySelector('[data-maker-picker]');
  const makerPickerLabel = enhancementPanel?.querySelector('[data-maker-picker-label]');
  const makerPickerGrid = enhancementPanel?.querySelector('[data-maker-picker-grid]');
  const makerPickerBack = enhancementPanel?.querySelector('[data-maker-picker-back]');

  const itemLevelUpToggle = enhancementPanel?.querySelector('[data-item-level-up-toggle]');
  const itemLevelUpArea = enhancementPanel?.querySelector('[data-item-level-up-area]');
  const itemLevelUpSlots = enhancementPanel?.querySelector('[data-item-level-up-slots]');
  const itemLevelUpEditor = enhancementPanel?.querySelector('[data-item-level-up-editor]');

  const requestEnhancementMutation = (mutation) => {
    if (typeof window.__evGuardEnhancementMutation === 'function') {
      window.__evGuardEnhancementMutation(mutation);
      return;
    }
    mutation();
  };

  const makerPanel = initMakerPanel({
    makerSection,
    makerToggle,
    makerGemArea,
    makerStimulantSlot,
    makerStimulantEditor,
    makerStimulantEditorLabel,
    makerStimulantEditorGrid,
    makerGemSlots,
    makerPicker,
    makerPickerLabel,
    makerPickerGrid,
    makerPickerBack,
    renderEnhancedItemCard,
    requestMutation: requestEnhancementMutation,
    onMakerOpen: () => itemLevelUpPanel.closeArea(),
    onStateChange: () => notifyEv(),
  });

  const itemLevelUpPanel = initItemLevelUpPanel({
    toggle: itemLevelUpToggle,
    area: itemLevelUpArea,
    slots: itemLevelUpSlots,
    editor: itemLevelUpEditor,
    renderEnhancedItemCard,
    requestMutation: requestEnhancementMutation,
    onToggleOpen: () => makerPanel.closeMakerPanel(),
    onStateChange: () => notifyEv(),
  });

  let scrollIndex = [];
  let scrollsByEquipmentKind = new Map();
  let itemLevelUpByItemId = new Map();
  let enhancementState = null;
  let selectedBaseItem = null;
  let selectedItemLevelUpDefinition = null;
  let activeScrollStatFilter = 'all';
  let currentGradeColor = null;

  // Internal keys that are item metadata, not stats chaos can modify
  const NON_STAT_KEYS = new Set(['upgradeSlots', 'attackSpeed']);
  const ITEM_LEVEL_UP_KINDS = new Set(['reverse', 'timeless']);
  const STAT_KEY_RANK = {
    weaponAttack: 0,
    magicAttack: 1,
    str: 2,
    dex: 3,
    int: 4,
    luk: 5,
    maxHp: 6,
    maxMp: 7,
    weaponDefense: 8,
    magicDefense: 9,
    accuracy: 10,
    avoidability: 11,
    speed: 12,
    jump: 13,
  };

  // Chaos scroll state
  let chaosStepperValues = new Map(); // statKey → number (-5..5)
  let activeChaosScroll = null; // the chaos scroll definition currently expanded
  let activeChaosOptionEl = null; // the DOM element of the expanded scroll option

  const showEnhancementDormant = () => {
    if (
      !(enhancementPanel instanceof HTMLElement) ||
      !(enhancementDormant instanceof HTMLElement) ||
      !(enhancementActive instanceof HTMLElement)
    ) {
      return;
    }

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = false;
    enhancementActive.hidden = true;
    if (resetButton instanceof HTMLElement) {
      resetButton.hidden = true;
    }
  };

  const showEnhancementError = (message) => {
    if (
      !(enhancementPanel instanceof HTMLElement) ||
      !(enhancementDormant instanceof HTMLElement) ||
      !(enhancementActive instanceof HTMLElement)
    ) {
      return;
    }

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = true;
    enhancementActive.hidden = true;

    if (enhancementMessage instanceof HTMLElement) {
      enhancementMessage.textContent = message;
      enhancementMessage.hidden = false;
    }
    if (resetButton instanceof HTMLElement) {
      resetButton.hidden = true;
    }
  };

  const supportsItemLevelUp = (levelUpDefinition) =>
    ITEM_LEVEL_UP_KINDS.has(levelUpDefinition?.levelUpKind);

  const renderSlotRow = () => {
    if (!(slotCheckpointRow instanceof HTMLElement) || !enhancementState) {
      return;
    }

    slotCheckpointRow.replaceChildren();

    for (let i = 0; i < enhancementState.scrollState.slotCount; i++) {
      const box = document.createElement('div');
      box.setAttribute('role', 'button');
      box.setAttribute('tabindex', '0');
      box.className = 'slot-box';
      box.dataset.slotIndex = String(i);

      const number = document.createElement('span');
      number.className = 'slot-box-number';
      number.textContent = String(i + 1);
      box.append(number);

      const scroll = enhancementState.scrollState.slots[i];
      const isCurrent = i === enhancementState.scrollState.currentSlot;

      if (scroll) {
        box.classList.add('slot-box--filled');

        // Replace the number with the scroll's icon
        number.replaceChildren();
        if (scroll.id === '__failed_scroll__') {
          const icon = document.createElement('span');
          icon.className = 'slot-box-icon';
          icon.setAttribute('aria-label', scroll.nameKo);
          icon.style.display = 'inline-flex';
          icon.style.alignItems = 'center';
          icon.style.justifyContent = 'center';
          icon.style.color = '#e74c3c';
          icon.style.fontSize = '22px';
          icon.style.fontWeight = '700';
          icon.textContent = '✕';
          number.append(icon);
        } else {
          const icon = document.createElement('img');
          icon.className = 'slot-box-icon';
          icon.src = buildItemIconUrl(
            scroll.behavior_type === 'chaos' ? CHAOS_SCROLL_ICON_ID : scroll.id,
          );
          icon.alt = scroll.nameKo;
          icon.loading = 'lazy';
          number.append(icon);
        }

        // × clear button — <span> avoids <button> grid-stretch quirk
        const xBtn = document.createElement('span');
        xBtn.setAttribute('role', 'button');
        xBtn.setAttribute('tabindex', '0');
        xBtn.className = 'slot-box-x';
        xBtn.setAttribute('aria-label', `슬롯 ${i + 1} 지우기`);
        xBtn.textContent = '×';
        xBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          requestEnhancementMutation(() => {
            collapseChaosPanel();
            clearSlot(enhancementState.scrollState, i);
            hideScrollDetail();
            renderSlotRow();
            renderScrollList(selectedBaseItem);
            refreshEnhancedCard();
            notifyEv();
          });
        });
        xBtn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            xBtn.click();
          }
        });
        box.append(xBtn);
      }

      if (isCurrent) {
        box.classList.add('slot-box--current');
      }

      // All slots are clickable — clicking selects the slot without
      // deleting later scrolls. Picking a new scroll replaces only this slot.
      box.addEventListener('click', () => {
        collapseChaosPanel();
        revertToSlot(enhancementState, i);
        renderSlotRow();
        if (scroll) {
          showScrollDetail(scroll);
        } else {
          hideScrollDetail();
        }
        refreshEnhancedCard();
      });

      // Keyboard support for Enter/Space on the div[role=button]
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          box.click();
        }
      });

      slotCheckpointRow.append(box);
    }

    renderEnhancementSummary();
  };

  const renderEnhancementSummary = () => {
    if (
      !(enhancementSummary instanceof HTMLElement) ||
      !(enhancementSummaryStats instanceof HTMLElement) ||
      !(scrollSection instanceof HTMLElement) ||
      !enhancementState ||
      !selectedBaseItem
    ) {
      return;
    }

    const remaining = computeRemainingSlots(enhancementState);
    if (remaining !== 0) {
      // Not all slots filled — show editor, hide summary
      enhancementSummary.hidden = true;
      scrollSection.hidden = false;
      return;
    }

    // All slots filled — hide editor, show summary
    scrollSection.hidden = true;
    enhancementSummary.hidden = false;

    // Compute total stat delta from all enhancement sources
    const accumulated = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    const baseStats = selectedBaseItem.stats ?? {};

    const deltas = [];
    for (const key of Object.keys(accumulated)) {
      if (key === 'upgradeSlots' || key === 'attackSpeed') continue;
      const baseValue = Number.isFinite(baseStats[key]) ? baseStats[key] : 0;
      const delta = accumulated[key] - baseValue;
      if (delta !== 0 && Number.isFinite(delta)) {
        deltas.push({ key, delta });
      }
    }

    // Sort by the same STAT_KEY_RANK used in the rest of the panel
    deltas.sort((a, b) => {
      const rankA = STAT_KEY_RANK[a.key] ?? 99;
      const rankB = STAT_KEY_RANK[b.key] ?? 99;
      return rankA - rankB;
    });

    enhancementSummaryStats.replaceChildren();

    if (deltas.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'enhancement-summary-stat';
      empty.textContent = '변동없음';
      enhancementSummaryStats.append(empty);
      return;
    }

    for (const { key, delta } of deltas) {
      const label = statLabelByKey[key] ?? key;
      const sign = delta > 0 ? '+' : '';
      const line = document.createElement('p');
      line.className = 'enhancement-summary-stat';
      line.textContent = `└ ${label} ${sign}${delta}`;
      enhancementSummaryStats.append(line);
    }
  };

  const showScrollDetail = (scroll) => {
    if (
      !(scrollDetailPopup instanceof HTMLElement) ||
      !(scrollDetailName instanceof HTMLElement) ||
      !(scrollDetailStat instanceof HTMLElement)
    ) {
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
      .filter((key) => Number.isFinite(accumulatedStats[key]))
      .filter((key) => accumulatedStats[key] > 0)
      .sort((a, b) => getStatPriority(a) - getStatPriority(b) || a.localeCompare(b, 'ko-KR'));
  };

  const getPositiveScrollStatKeys = (scroll) =>
    Object.keys(scroll?.stats ?? {})
      .filter((key) => Number.isFinite(scroll.stats[key]))
      .filter((key) => scroll.stats[key] > 0);

  const getStatPriority = (key) => STAT_KEY_RANK[key] ?? 99;

  const renderScrollStatFilters = (available) => {
    if (!(scrollStatFilters instanceof HTMLElement)) {
      return;
    }

    scrollStatFilters.replaceChildren();

    const visibleStatKeys = [
      ...new Set(available.flatMap((scroll) => getPositiveScrollStatKeys(scroll))),
    ].sort((a, b) => getStatPriority(a) - getStatPriority(b) || a.localeCompare(b, 'ko-KR'));

    const filterKeys = ['all', ...visibleStatKeys];
    if (activeScrollStatFilter !== 'all' && !visibleStatKeys.includes(activeScrollStatFilter)) {
      activeScrollStatFilter = 'all';
    }

    filterKeys.forEach((key) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'scroll-stat-filter';
      button.dataset.scrollStatFilter = key;
      button.textContent = key === 'all' ? '전체' : (statLabelByKey[key] ?? key);
      button.setAttribute('aria-pressed', String(activeScrollStatFilter === key));
      if (activeScrollStatFilter === key) {
        button.classList.add('scroll-stat-filter--active');
      }
      button.addEventListener('click', () => {
        activeScrollStatFilter = button.dataset.scrollStatFilter;
        collapseChaosPanel();
        renderScrollList(selectedBaseItem);
      });
      scrollStatFilters.append(button);
    });
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
      const isHpMp = HP_MP_KEYS.has(key);
      const step = isHpMp ? 10 : 1;
      const limit = isHpMp ? 50 : 5;

      const row = document.createElement('div');
      row.className = 'chaos-stat-row';

      const label = document.createElement('span');
      label.className = 'chaos-stat-label';
      label.textContent = statLabelByKey[key] ?? key;

      const minMaxBtn = document.createElement('button');
      minMaxBtn.type = 'button';
      minMaxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
      minMaxBtn.textContent = 'MIN';
      minMaxBtn.addEventListener('click', () => {
        chaosStepperValues.set(key, -limit);
        updateChaosStepperDisplay(row, key);
      });

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'chaos-stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        const cur = chaosStepperValues.get(key) ?? 0;
        if (cur > -limit) {
          chaosStepperValues.set(key, cur - step);
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
        if (cur < limit) {
          chaosStepperValues.set(key, cur + step);
          updateChaosStepperDisplay(row, key);
        }
      });

      const maxBtn = document.createElement('button');
      maxBtn.type = 'button';
      maxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
      maxBtn.textContent = 'MAX';
      maxBtn.addEventListener('click', () => {
        chaosStepperValues.set(key, limit);
        updateChaosStepperDisplay(row, key);
      });

      row.append(label, minMaxBtn, minusBtn, valueDisplay, plusBtn, maxBtn);
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

      requestEnhancementMutation(() => {
        const applied = applyScroll(enhancementState, scrollEntry);
        if (!applied) return;

        renderSlotRow();
        renderScrollList(selectedBaseItem);
        hideScrollDetail();
        refreshEnhancedCard();
        notifyEv();

        // Re-locate the chaos option in the rebuilt DOM and keep the panel open
        const chaosOptions = scrollList.querySelectorAll('.scroll-option');
        for (const opt of chaosOptions) {
          const nameEl = opt.querySelector('.scroll-option-name');
          if (nameEl?.textContent === activeChaosScroll.nameKo) {
            activeChaosOptionEl = opt;
            break;
          }
        }

        // Re-render the chaos panel into the new DOM element
        if (activeChaosOptionEl) {
          renderChaosInputPanel(activeChaosOptionEl);

          // Disable 적용 button if no more slots
          const newRemaining = computeRemainingSlots(enhancementState);
          if (newRemaining <= 0) {
            const btn = activeChaosOptionEl.querySelector('.chaos-apply-button');
            if (btn) {
              btn.disabled = true;
            }
          }
        }
      });
    });

    panel.append(applyBtn);
    optionEl.append(panel);
  };

  const renderScrollList = (item) => {
    if (!(scrollList instanceof HTMLElement) || !(enhancementMessage instanceof HTMLElement)) {
      return;
    }

    scrollList.replaceChildren();
    enhancementMessage.hidden = true;

    const scrolls = scrollsByEquipmentKind.get(item.equipmentKind) ?? [];

    // Phase 1: filter by item-specific targeting
    const eligible = scrolls.filter((scroll) => {
      if (scroll.targetItemId == null) return true;
      return scroll.targetItemId === item.id;
    });

    // Phase 2: filter out scrolls that have reached their max application count
    const available = eligible.filter((scroll) => {
      if (scroll.maxApplications == null) return true;
      const applied = enhancementState.scrollState.slots.filter((s) => s?.id === scroll.id).length;
      return applied < scroll.maxApplications;
    });

    renderScrollStatFilters(available);

    const visible =
      activeScrollStatFilter === 'all'
        ? available
        : available.filter((scroll) => {
            const scrollStats = new Set(getPositiveScrollStatKeys(scroll));
            return scrollStats.has(activeScrollStatFilter);
          });

    if (available.length === 0) {
      enhancementMessage.textContent = '이 장비 종류에 해당하는 주문서가 없습니다';
      enhancementMessage.hidden = false;
      return;
    }

    scrollList.hidden = false;

    if (visible.length === 0) {
      enhancementMessage.textContent = '선택한 스탯에 해당하는 주문서가 없습니다';
      enhancementMessage.hidden = false;
      return;
    }

    visible.forEach((scroll) => {
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
      icon.src = buildItemIconUrl(
        scroll.behavior_type === 'chaos' ? CHAOS_SCROLL_ICON_ID : scroll.id,
      );
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
          option.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          return;
        }

        requestEnhancementMutation(() => {
          // Non-chaos scroll: collapse chaos panel and apply normally
          collapseChaosPanel();
          const applied = applyScroll(enhancementState, scroll);
          if (!applied) return;

          renderSlotRow();
          renderScrollList(selectedBaseItem);
          hideScrollDetail();
          refreshEnhancedCard();
          notifyEv();
        });
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

    // Append synthetic "failed scroll" entry — always last, all-stats only
    if (activeScrollStatFilter === 'all') {
      const failOption = document.createElement('button');
      failOption.type = 'button';
      failOption.className = 'scroll-option';

      const failIcon = document.createElement('span');
      failIcon.className = 'scroll-option-icon';
      failIcon.setAttribute('aria-hidden', 'true');
      failIcon.style.display = 'inline-flex';
      failIcon.style.alignItems = 'center';
      failIcon.style.justifyContent = 'center';
      failIcon.style.width = '28px';
      failIcon.style.height = '28px';
      failIcon.style.color = '#e74c3c';
      failIcon.style.fontSize = '22px';
      failIcon.style.fontWeight = '700';
      failIcon.textContent = '✕';

      const failText = document.createElement('span');
      failText.className = 'scroll-option-text';

      const failName = document.createElement('span');
      failName.className = 'scroll-option-name';
      failName.textContent = '주문서 실패';

      const failStat = document.createElement('span');
      failStat.className = 'scroll-option-stat';
      failStat.textContent = '스탯 변화 없음';

      failText.append(failName, failStat);
      failOption.append(failIcon, failText);

      failOption.addEventListener('click', () => {
        if (!enhancementState || !selectedBaseItem) return;

        requestEnhancementMutation(() => {
          collapseChaosPanel();
          const applied = applyScroll(enhancementState, {
            id: '__failed_scroll__',
            nameKo: '주문서 실패',
            equipmentKind: item.equipmentKind,
            behavior_type: 'fixed',
            stats: {},
          });
          if (!applied) return;

          renderSlotRow();
          renderScrollList(selectedBaseItem);
          hideScrollDetail();
          refreshEnhancedCard();
          notifyEv();
        });
      });

      scrollList.append(failOption);
    }
  };

  const refreshEnhancedCard = () => {
    if (!selectedBaseItem || !enhancementState) {
      return;
    }

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    const statBreakdown = computeStatBreakdown(selectedBaseItem.stats, enhancementState);
    const remaining = computeRemainingSlots(enhancementState);
    const appliedCount = computeAppliedScrollCount(enhancementState);
    currentGradeColor = computeGradeColor(enhancementState);
    const itemLevelUpMeta = computeItemLevelUpCardMeta(
      enhancementState,
      selectedItemLevelUpDefinition,
    );

    renderEnhancedItemCard(
      selectedBaseItem,
      accumulatedStats,
      remaining,
      appliedCount,
      currentGradeColor,
      statBreakdown,
      itemLevelUpMeta,
    );
  };

  const activatePanel2 = (item) => {
    if (
      !(enhancementPanel instanceof HTMLElement) ||
      !(enhancementDormant instanceof HTMLElement) ||
      !(enhancementActive instanceof HTMLElement) ||
      !(enhancementEquipmentKind instanceof HTMLElement)
    ) {
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
      itemLevelUpPanel.deactivate();
      if (resetButton instanceof HTMLElement) {
        resetButton.hidden = true;
      }
      return;
    }

    const levelUpDefinition = itemLevelUpByItemId.get(item.id) ?? null;
    const itemLevelUpDefinition = supportsItemLevelUp(levelUpDefinition) ? levelUpDefinition : null;
    selectedBaseItem = item;
    selectedItemLevelUpDefinition = itemLevelUpDefinition;
    enhancementState = createEnhancementState(
      upgradeSlots,
      item.requiredLevel ?? 0,
      itemLevelUpDefinition,
      item.requiredJobs ?? [],
    );
    collapseChaosPanel();
    chaosStepperValues = new Map();
    activeScrollStatFilter = 'all';

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = true;
    enhancementActive.hidden = false;
    enhancementEquipmentKind.textContent = item.equipmentKind;
    if (resetButton instanceof HTMLElement) {
      resetButton.hidden = false;
    }

    hideScrollDetail();
    renderSlotRow();
    renderScrollList(item);
    makerPanel.activate(enhancementState, item);
    itemLevelUpPanel.activate(enhancementState, item, itemLevelUpDefinition);
    refreshEnhancedCard();
    notifyEv();
  };

  const restoreEnhancementState = (storedState, item) => {
    if (
      !(enhancementPanel instanceof HTMLElement) ||
      !(enhancementDormant instanceof HTMLElement) ||
      !(enhancementActive instanceof HTMLElement) ||
      !(enhancementEquipmentKind instanceof HTMLElement)
    ) {
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
      itemLevelUpPanel.deactivate();
      if (resetButton instanceof HTMLElement) {
        resetButton.hidden = true;
      }
      return;
    }

    const levelUpDefinition = itemLevelUpByItemId.get(item.id) ?? null;
    const itemLevelUpDefinition = supportsItemLevelUp(levelUpDefinition) ? levelUpDefinition : null;
    selectedBaseItem = item;
    selectedItemLevelUpDefinition = itemLevelUpDefinition;

    // Use the saved enhancement state instead of creating a fresh one
    enhancementState = storedState;
    collapseChaosPanel();
    chaosStepperValues = new Map();
    activeScrollStatFilter = 'all';

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = true;
    enhancementActive.hidden = false;
    enhancementEquipmentKind.textContent = item.equipmentKind;
    if (resetButton instanceof HTMLElement) {
      resetButton.hidden = false;
    }

    hideScrollDetail();
    renderSlotRow();
    renderScrollList(item);
    makerPanel.activate(enhancementState, item);
    itemLevelUpPanel.activate(enhancementState, item, itemLevelUpDefinition);
    refreshEnhancedCard();
    notifyEv();
  };

  resetButton?.addEventListener('click', () => {
    if (!enhancementState || !selectedBaseItem) {
      return;
    }

    // Confirmation dialog
    const overlay = document.createElement('div');
    overlay.className = 'ev-confirm-overlay';

    const dialog = document.createElement('div');
    dialog.className = 'ev-confirm-dialog';

    const msg = document.createElement('p');
    msg.textContent = '모든 강화 설정과 계산 결과가 초기화됩니다. 계속하시겠습니까?';

    const buttonRow = document.createElement('div');
    buttonRow.className = 'ev-confirm-buttons';

    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = '초기화';
    confirmBtn.addEventListener('click', () => {
      overlay.remove();

      resetState(enhancementState);
      collapseChaosPanel();
      chaosStepperValues = new Map();
      hideScrollDetail();
      renderSlotRow();
      renderScrollList(selectedBaseItem);
      makerPanel.resetMakerUI();
      itemLevelUpPanel.reset();
      refreshEnhancedCard();
      notifyEv();

      // Clear EV results panel
      if (typeof window.__evClear === 'function') {
        window.__evClear();
      }

      // Re-render calc panel target selection for the reset state
      if (typeof window.__evOpenCalcPanel === 'function') {
        window.__evOpenCalcPanel();
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', () => {
      overlay.remove();
    });

    buttonRow.append(confirmBtn, cancelBtn);
    dialog.append(msg, buttonRow);
    overlay.append(dialog);
    document.body.append(overlay);
  });

  const sortScrollList = (list) => {
    const getScrollStatPriority = (stats) => {
      const keys = Object.keys(stats ?? {});
      let best = 99;
      for (const key of keys) {
        const rank = STAT_KEY_RANK[key];
        if (rank !== undefined && rank < best) best = rank;
      }
      return best;
    };

    const stemName = (n) =>
      String(n ?? '')
        .replace(/(\d+)%$/, '')
        .trimEnd();

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

    // Normalize stat priority within name-stem groups so same-named scrolls
    // (e.g. 너클 명중률 주문서 100% and 너클 명중률 주문서 60%) stay together
    // even when their secondary stats differ.
    const stemBestPriority = new Map();
    for (const s of nonChaos) {
      const stem = stemName(s.nameKo);
      const priority = getScrollStatPriority(s.stats);
      const current = stemBestPriority.get(stem);
      if (current === undefined || priority < current) {
        stemBestPriority.set(stem, priority);
      }
    }
    const sortPriority = (s) => stemBestPriority.get(stemName(s.nameKo)) ?? 99;

    nonChaos.sort(
      (a, b) =>
        sortPriority(a) - sortPriority(b) ||
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
    fetch('/data/scroll-overrides.local.json')
      .then((r) => {
        if (!r.ok) {
          // Overrides file is optional — 404 is fine
          return [];
        }
        return r.json();
      })
      .catch(() => []),
    fetch('/data/item-level-ups-gms83-ko.json')
      .then((r) => {
        if (!r.ok) return [];
        return r.json();
      })
      .catch(() => []),
  ])
    .then(([scrolls, overrides, itemLevelUps]) => {
      scrollIndex = Array.isArray(scrolls) ? scrolls : [];
      const overrideList = Array.isArray(overrides) ? overrides : [];
      scrollsByEquipmentKind = new Map();
      itemLevelUpByItemId = new Map(
        (Array.isArray(itemLevelUps) ? itemLevelUps : [])
          .filter((levelUpDefinition) => Number.isInteger(levelUpDefinition.itemId))
          .map((levelUpDefinition) => [levelUpDefinition.itemId, levelUpDefinition]),
      );

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
            // When a wildcard chaos-scroll override is present, remove the
            // equipment-specific chaos scrolls from the main index (e.g.
            // "한손검 혼돈의 주문서") so only the canonical chaos scroll remains.
            if (override.behavior_type === 'chaos') {
              const list = scrollsByEquipmentKind.get(kind);
              for (let i = list.length - 1; i >= 0; i--) {
                if (list[i].behavior_type === 'chaos') {
                  list.splice(i, 1);
                }
              }
            }
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

      // Signal that enhancement data is ready (for decon→EV transfer)
      window.dispatchEvent(new CustomEvent('enhancementDataReady'));
    })
    .catch((_error) => {
      showEnhancementError('주문서 데이터를 불러오지 못했습니다');
    });

  // Expose enhancement state for expected value calculator
  window.__evState = () => ({
    enhancementState,
    selectedBaseItem,
    scrollsByEquipmentKind,
    selectedItemLevelUpDefinition,
    currentGradeColor,
  });

  // Expose restore function so saved slots can reload enhancement state
  window.__restoreEvState = restoreEnhancementState;

  // Expose item-level-up-by-id map for deconstruction strategy transfer
  window.__evGetItemLevelUpById = () => itemLevelUpByItemId;

  /**
   * Notifies the EV calculator (if available) that the enhancement state changed.
   * Called from refreshEnhancedCard (every state change) and the reset handler.
   */
  const notifyEv = () => {
    currentGradeColor = computeGradeColor(enhancementState);
    if (typeof window.__evRefresh === 'function') {
      window.__evRefresh();
    }
  };

  showEnhancementDormant();

  return activatePanel2;
}
