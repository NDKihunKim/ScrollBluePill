import { createScrollState, applyScroll, revertToSlot, resetState, computeAccumulatedStats, formatScrollStatLine, computeAppliedScrollCount, computeRemainingSlots } from './scrollState.mjs';
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

  let scrollIndex = [];
  let scrollsByEquipmentKind = new Map();
  let scrollState = null;
  let selectedBaseItem = null;

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
    if (!(slotCheckpointRow instanceof HTMLElement) || !scrollState) {
      return;
    }

    slotCheckpointRow.replaceChildren();

    for (let i = 0; i < scrollState.slotCount; i++) {
      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'slot-box';
      box.textContent = String(i + 1);

      const scroll = scrollState.slots[i];
      const isCurrent = i === scrollState.currentSlot;

      if (scroll) {
        box.classList.add('slot-box--filled');
      }

      if (isCurrent) {
        box.classList.add('slot-box--current');
      }

      if (scroll || isCurrent) {
        box.addEventListener('click', () => {
          if (scroll) {
            revertToSlot(scrollState, i);
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
      const option = document.createElement('button');
      option.type = 'button';
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

      option.addEventListener('click', () => {
        if (!scrollState || !selectedBaseItem) {
          return;
        }

        const applied = applyScroll(scrollState, scroll);
        if (!applied) {
          return;
        }

        hideScrollDetail();
        renderSlotRow();
        refreshEnhancedCard();
      });

      scrollList.append(option);
    });
  };

  const refreshEnhancedCard = () => {
    if (!selectedBaseItem || !scrollState) {
      return;
    }

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, scrollState);
    const remaining = computeRemainingSlots(scrollState);
    const appliedCount = computeAppliedScrollCount(scrollState);

    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount);
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
      return;
    }

    selectedBaseItem = item;
    scrollState = createScrollState(upgradeSlots);

    enhancementPanel.hidden = false;
    enhancementDormant.hidden = true;
    enhancementActive.hidden = false;
    enhancementEquipmentKind.textContent = item.equipmentKind;

    hideScrollDetail();
    renderSlotRow();
    renderScrollList(item.equipmentKind);
    refreshEnhancedCard();
  };

  resetButton?.addEventListener('click', () => {
    if (!scrollState || !selectedBaseItem) {
      return;
    }

    resetState(scrollState);
    hideScrollDetail();
    renderSlotRow();
    refreshEnhancedCard();
  });

  fetch('/data/scrolls-gms83-ko.json')
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Unable to load scroll index: ${response.status}`);
      }
      return response.json();
    })
    .then((scrolls) => {
      scrollIndex = Array.isArray(scrolls) ? scrolls : [];
      scrollsByEquipmentKind = new Map();

      scrollIndex.forEach((scroll) => {
        const kind = scroll.equipmentKind;
        if (!scrollsByEquipmentKind.has(kind)) {
          scrollsByEquipmentKind.set(kind, []);
        }
        scrollsByEquipmentKind.get(kind).push(scroll);
      });

            // Stat priority order by Korean stat name in scroll title
      const STAT_PRIORITY = [
        '공격력',
        '마력',
        '힘',
        '민첩',
        '지력',
        '행운',
      ];

      const getStatPriority = (nameKo) => {
        for (let p = 0; p < STAT_PRIORITY.length; p++) {
          if (nameKo?.includes(STAT_PRIORITY[p])) return p;
        }
        return STAT_PRIORITY.length;
      };

      const percentPattern = /(\d+)%$/;
      const extractPercent = (name) => {
        const match = name?.match(percentPattern);
        return match ? Number(match[1]) : 0;
      };

      for (const s of scrollsByEquipmentKind.values()) {
        s.sort((a, b) =>
          getStatPriority(a.nameKo) - getStatPriority(b.nameKo) ||
          extractPercent(b.nameKo) - extractPercent(a.nameKo) ||
          a.nameKo.localeCompare(b.nameKo, 'ko-KR'),
        );
      }
    })
    .catch((error) => {
      console.error(error);
      showEnhancementError('주문서 데이터를 불러오지 못했습니다');
    });

  showEnhancementDormant();

  return activatePanel2;
}
