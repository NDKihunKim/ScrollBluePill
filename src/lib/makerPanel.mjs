import { GEM_GRADES, GEM_ITEM_IDS, GEM_STAT_COLORS, getVisibleGemTypes, getGemTypeByKey, statLabelByKey } from './makerData.mjs';
import { activateMaker, deactivateMaker, applyGem, revertGemSlot, computeAccumulatedStats, computeGradeColor, computeAppliedScrollCount, computeRemainingSlots } from './enhancementState.mjs';
import { buildItemIconUrl } from './maplestoryIo.mjs';

function createGemIconElement(gemKey, stat, iconId) {
  if (iconId !== 0) {
    const img = document.createElement('img');
    img.src = buildItemIconUrl(iconId);
    img.alt = '';
    img.loading = 'lazy';
    return img;
  }

  const placeholder = document.createElement('span');
  placeholder.className = 'maker-gem-icon';
  const color = GEM_STAT_COLORS[stat] ?? '#666';
  placeholder.style.backgroundColor = color;
  const label = statLabelByKey[stat] ?? stat;
  placeholder.textContent = label.slice(0, 2);
  return placeholder;
}


export function initMakerPanel({
  makerSection,
  makerToggle,
  makerGemArea,
  makerGemSlots,
  makerPicker,
  makerPickerLabel,
  makerPickerGrid,
  makerPickerBack,
  renderEnhancedItemCard,
}) {
  let enhancementState = null;
  let selectedBaseItem = null;
  let editingSlotIndex = -1;
  let pendingGemKey = null;

  const SLOT_COUNT = 3;

  const hidePicker = () => {
    if (makerPicker instanceof HTMLElement) {
      makerPicker.hidden = true;
    }
    pendingGemKey = null;
    editingSlotIndex = -1;
  };

  const refreshEnhancedCard = () => {
    if (!selectedBaseItem || !enhancementState) return;

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    const remaining = computeRemainingSlots(enhancementState);
    const appliedCount = computeAppliedScrollCount(enhancementState);
    const gradeColor = computeGradeColor(enhancementState);

    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor);
  };

  const renderGemSlots = () => {
    if (!(makerGemSlots instanceof HTMLElement) || !enhancementState) return;

    makerGemSlots.replaceChildren();

    for (let i = 0; i < SLOT_COUNT; i++) {
      const box = document.createElement('button');
      box.type = 'button';
      box.className = 'maker-gem-slot';

      const isDisabled = i >= enhancementState.gemSlotCount;
      const gemSlot = i < enhancementState.gemSlots.length ? enhancementState.gemSlots[i] : null;

      if (isDisabled) {
        box.classList.add('maker-gem-slot--disabled');
      }

      if (!isDisabled && !gemSlot && editingSlotIndex === i) {
        box.classList.add('maker-gem-slot--active');
      }

      if (gemSlot) {
        box.classList.add('maker-gem-slot--filled');

        const gem = getGemTypeByKey(gemSlot.gemKey);
        if (gem) {
          const gradeKey = gemSlot.gradeIndex === 2 ? 'high' : gemSlot.gradeIndex === 1 ? 'mid' : 'low';
          const iconId = GEM_ITEM_IDS[gem.key]?.[gradeKey] ?? 0;

          const img = createGemIconElement(gem.key, gem.stat, iconId);

          const nameSpan = document.createElement('span');
          nameSpan.className = 'maker-gem-slot-name';
          nameSpan.textContent = gem.nameKo;

          const gradeSpan = document.createElement('span');
          gradeSpan.className = 'maker-gem-slot-grade';
          gradeSpan.textContent = GEM_GRADES[gemSlot.gradeIndex];

          box.append(img, nameSpan, gradeSpan);
        }
      }

      if (!isDisabled || gemSlot) {
        box.addEventListener('click', () => {
          if (!enhancementState || isDisabled) return;

          if (gemSlot) {
            revertGemSlot(enhancementState, i);
            renderGemSlots();
            refreshEnhancedCard();
            return;
          }

          editingSlotIndex = i;
          renderGemSlots();
          renderStep1Picker();
        });
      }

      makerGemSlots.append(box);
    }
  };

  const renderStep1Picker = () => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement) ||
        !enhancementState || !selectedBaseItem) {
      return;
    }

    makerPickerLabel.textContent = '보석 종류 선택';
    makerPickerGrid.replaceChildren();
    makerPicker.hidden = false;
    if (makerPickerBack instanceof HTMLElement) makerPickerBack.hidden = true;

    const usedKeys = enhancementState.gemSlots
      .filter((s) => s !== null)
      .map((s) => s.gemKey);

    const visibleGems = getVisibleGemTypes(selectedBaseItem.equipmentKind, usedKeys);

    visibleGems.forEach((gem) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'maker-picker-item';

      if (gem.disabled) {
        item.classList.add('maker-picker-item--disabled');
      }

      const step1IconId = GEM_ITEM_IDS[gem.key]?.base ?? 0;
      const img = createGemIconElement(gem.key, gem.stat, step1IconId);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = gem.nameKo;

      const statSpan = document.createElement('span');
      statSpan.className = 'maker-picker-item-stat';
      statSpan.textContent = `(${statLabelByKey[gem.stat] ?? gem.stat})`;

      item.append(img, nameSpan, statSpan);

      if (!gem.disabled) {
        item.addEventListener('click', () => {
          pendingGemKey = gem.key;
          renderStep2Picker();
        });
      }

      makerPickerGrid.append(item);
    });
  };

  const renderStep2Picker = () => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement)) {
      return;
    }

    const gem = getGemTypeByKey(pendingGemKey);
    if (!gem) return;

    makerPickerLabel.textContent = `등급 선택 — ${gem.nameKo}`;
    makerPickerGrid.replaceChildren();
    if (makerPickerBack instanceof HTMLElement) makerPickerBack.hidden = false;

    for (let gradeIndex = 2; gradeIndex >= 0; gradeIndex--) {
      const value = gem.values[gradeIndex];
      const gradeLabel = GEM_GRADES[gradeIndex];
      const statLabel = statLabelByKey[gem.stat] ?? gem.stat;

      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'maker-picker-item';

      const gradeKey = gradeIndex === 2 ? 'high' : gradeIndex === 1 ? 'mid' : 'low';
      const step2IconId = GEM_ITEM_IDS[gem.key]?.[gradeKey] ?? 0;

      const img = createGemIconElement(gem.key, gem.stat, step2IconId);

      const gradeSpan = document.createElement('span');
      gradeSpan.textContent = gradeLabel;

      const valueSpan = document.createElement('span');
      valueSpan.className = 'maker-picker-item-stat';
      valueSpan.textContent = `${statLabel} +${value}`;

      item.append(img, gradeSpan, valueSpan);

      item.addEventListener('click', () => {
        if (!enhancementState || editingSlotIndex < 0) return;

        const ok = applyGem(enhancementState, editingSlotIndex, gem.key, gradeIndex);
        if (!ok) return;

        pendingGemKey = null;

        let nextEmpty = -1;
        for (let i = 0; i < enhancementState.gemSlotCount; i++) {
          const s = i < enhancementState.gemSlots.length ? enhancementState.gemSlots[i] : null;
          if (!s) { nextEmpty = i; break; }
        }

        renderGemSlots();
        refreshEnhancedCard();

        if (nextEmpty >= 0) {
          editingSlotIndex = nextEmpty;
          renderGemSlots();
          renderStep1Picker();
        } else {
          hidePicker();
          renderGemSlots();
        }
      });

      makerPickerGrid.append(item);
    }
  };

  const goBackToStep1 = () => {
    if (pendingGemKey) {
      renderStep1Picker();
    } else {
      hidePicker();
      renderGemSlots();
    }
  };

  if (makerPickerBack instanceof HTMLElement) {
    makerPickerBack.addEventListener('click', goBackToStep1);
  }

  const setupMakerToggle = () => {
    if (!(makerToggle instanceof HTMLElement) ||
        !(makerGemArea instanceof HTMLElement) ||
        !(makerSection instanceof HTMLElement)) {
      return;
    }

    const disableMaker = () => {
      if (enhancementState) {
        deactivateMaker(enhancementState);
      }
      makerToggle.classList.remove('maker-toggle-button--active');
      if (makerGemArea instanceof HTMLElement) makerGemArea.hidden = true;
      hidePicker();
      renderGemSlots();
      refreshEnhancedCard();
      makerToggle.textContent = '메이커';
    };

    const enableMaker = () => {
      if (enhancementState) {
        activateMaker(enhancementState);
      }
      makerToggle.classList.add('maker-toggle-button--active');
      if (makerGemArea instanceof HTMLElement) makerGemArea.hidden = false;

      let firstEmpty = -1;
      for (let i = 0; i < enhancementState.gemSlotCount; i++) {
        const s = i < enhancementState.gemSlots.length ? enhancementState.gemSlots[i] : null;
        if (!s) { firstEmpty = i; break; }
      }
      if (firstEmpty >= 0) {
        editingSlotIndex = firstEmpty;
      }

      renderGemSlots();
      makerToggle.textContent = '메이커 ✓';

      if (firstEmpty >= 0) {
        renderStep1Picker();
      }
    };

    makerToggle.addEventListener('click', () => {
      if (!enhancementState || makerToggle.disabled) return;

      if (enhancementState.makerActive) {
        disableMaker();
      } else {
        enableMaker();
      }
    });
  };

  setupMakerToggle();

  return {
    activate(enhState, item) {
      enhancementState = enhState;
      selectedBaseItem = item;

      if (makerSection instanceof HTMLElement) {
        makerSection.hidden = false;
      }

      const canUseMaker = enhancementState.gemSlotCount > 0;

      if (makerToggle instanceof HTMLElement) {
        makerToggle.disabled = !canUseMaker;
      }

      if (enhancementState.makerActive) {
        if (makerGemArea instanceof HTMLElement) {
          makerGemArea.hidden = false;
        }
        if (makerToggle instanceof HTMLElement) {
          makerToggle.classList.add('maker-toggle-button--active');
          makerToggle.textContent = '메이커 ✓';
        }
        renderGemSlots();
      } else {
        if (makerGemArea instanceof HTMLElement) {
          makerGemArea.hidden = true;
        }
        if (makerToggle instanceof HTMLElement) {
          makerToggle.classList.remove('maker-toggle-button--active');
          makerToggle.textContent = '메이커';
        }
      }
    },

    deactivate() {
      enhancementState = null;
      selectedBaseItem = null;
      hidePicker();

      if (makerSection instanceof HTMLElement) {
        makerSection.hidden = true;
      }
    },

    resetMakerUI() {
      hidePicker();
      if (makerToggle instanceof HTMLElement) {
        makerToggle.classList.remove('maker-toggle-button--active');
        makerToggle.textContent = '메이커';
        makerToggle.disabled = !enhancementState || enhancementState.gemSlotCount <= 0;
        if (makerSection instanceof HTMLElement) {
          makerSection.hidden = false;
        }
      }
      if (makerGemArea instanceof HTMLElement) {
        makerGemArea.hidden = true;
      }
      if (makerGemSlots instanceof HTMLElement) {
        makerGemSlots.replaceChildren();
      }
    },

    refreshGemView() {
      renderGemSlots();
      refreshEnhancedCard();
    },
  };
}
