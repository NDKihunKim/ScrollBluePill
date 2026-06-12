import { GEM_GRADES, GEM_ITEM_IDS, GEM_STAT_COLORS, getVisibleGemTypes, getGemTypeByKey, statLabelByKey } from './makerData.mjs';
import { activateMaker, deactivateMaker, applyGem, applyVariableGem, revertGemSlot, applyStimulant, clearStimulant, computeAccumulatedStats, computeStatBreakdown, computeGradeColor, computeAppliedScrollCount, computeRemainingSlots, HP_MP_KEYS } from './enhancementState.mjs';
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
  const STIMULANT_ITEM_ID = 4130000;
  const NON_STIMULANT_STAT_KEYS = new Set(['upgradeSlots', 'attackSpeed']);
  let stimulantValues = new Map();

  const hidePicker = () => {
    if (makerPicker instanceof HTMLElement) {
      makerPicker.hidden = true;
    }
    if (makerPickerGrid instanceof HTMLElement) {
      makerPickerGrid.classList.remove('maker-stimulant-input-panel');
    }
    pendingGemKey = null;
    editingSlotIndex = -1;
  };

  const refreshEnhancedCard = () => {
    if (!selectedBaseItem || !enhancementState) return;

    const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
    const statBreakdown = computeStatBreakdown(selectedBaseItem.stats, enhancementState);
    const remaining = computeRemainingSlots(enhancementState);
    const appliedCount = computeAppliedScrollCount(enhancementState);
    const gradeColor = computeGradeColor(enhancementState);

    renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor, statBreakdown);
  };

  const getStimulantStatKeys = () => {
    if (!selectedBaseItem || !enhancementState) return [];

    const cleanStats = selectedBaseItem.stats ?? {};
    return Object.keys(cleanStats)
      .filter((key) => !NON_STIMULANT_STAT_KEYS.has(key))
      .filter((key) => Number.isFinite(cleanStats[key]))
      .filter((key) => cleanStats[key] > 0);
  };

  const updateStimulantStepperDisplay = (rowEl, key) => {
    const valueDisplay = rowEl.querySelector('.maker-stimulant-stepper-value');
    if (!valueDisplay) return;

    const value = stimulantValues.get(key) ?? 0;
    valueDisplay.textContent = value > 0 ? `+${value}` : String(value);
  };

  const renderVariableGemInputPanel = (gem) => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement) ||
        !enhancementState || !selectedBaseItem) {
      return;
    }

    const cleanStats = selectedBaseItem.stats ?? {};
    const statKeys = (gem.variableKeys ?? []).filter((k) => Number.isFinite(cleanStats[k]) && cleanStats[k] > 0);

    makerPickerLabel.textContent = `${gem.nameKo} 스탯 입력`;
    makerPickerGrid.replaceChildren();
    makerPickerGrid.classList.add('maker-stimulant-input-panel');
    makerPicker.hidden = false;
    if (makerPickerBack instanceof HTMLElement) makerPickerBack.hidden = false;

    const limit = gem.variableLimit ?? 5;
    const existingSlot = enhancementState.gemSlots.find((s) => s?.gemKey === gem.key);
    const existingStats = existingSlot?.stats ?? {};

    const values = new Map();
    statKeys.forEach((key) => {
      values.set(key, Number.isFinite(existingStats[key]) ? existingStats[key] : 0);
    });

    if (statKeys.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'chaos-empty-message';
      msg.textContent = '적용할 스탯이 없습니다';
      makerPickerGrid.append(msg);
      return;
    }

    statKeys.forEach((key) => {
      const isHpMp = HP_MP_KEYS.has(key);
      const step = isHpMp ? 10 : 1;
      const keyLimit = isHpMp ? 50 : limit;

      const row = document.createElement('div');
      row.className = 'chaos-stat-row maker-stimulant-stat-row';

      const label = document.createElement('span');
      label.className = 'chaos-stat-label';
      label.textContent = statLabelByKey[key] ?? key;

      const minBtn = document.createElement('button');
      minBtn.type = 'button';
      minBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
      minBtn.textContent = 'MIN';
      minBtn.addEventListener('click', () => {
        values.set(key, -keyLimit);
        updateStimulantStepperDisplay(row, key);
      });

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'chaos-stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        const cur = values.get(key) ?? 0;
        if (cur > -keyLimit) {
          values.set(key, cur - step);
          updateStimulantStepperDisplay(row, key);
        }
      });

      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'chaos-stepper-value maker-stimulant-stepper-value';
      const initialVal = values.get(key) ?? 0;
      valueDisplay.textContent = initialVal > 0 ? `+${initialVal}` : String(initialVal);

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'chaos-stepper-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        const cur = values.get(key) ?? 0;
        if (cur < keyLimit) {
          values.set(key, cur + step);
          updateStimulantStepperDisplay(row, key);
        }
      });

      const maxBtn = document.createElement('button');
      maxBtn.type = 'button';
      maxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
      maxBtn.textContent = 'MAX';
      maxBtn.addEventListener('click', () => {
        values.set(key, keyLimit);
        updateStimulantStepperDisplay(row, key);
      });

      row.append(label, minBtn, minusBtn, valueDisplay, plusBtn, maxBtn);
      makerPickerGrid.append(row);
    });

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'chaos-apply-button maker-stimulant-apply-button';
    applyBtn.textContent = '적용';
    applyBtn.addEventListener('click', () => {
      const stats = {};
      for (const key of statKeys) {
        stats[key] = values.get(key) ?? 0;
      }
      applyVariableGem(enhancementState, editingSlotIndex, gem.key, stats);
      hidePicker();
      renderGemSlots();
      refreshEnhancedCard();
    });

    makerPickerGrid.append(applyBtn);
  };

  const renderStimulantInputPanel = () => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement) ||
        !enhancementState) {
      return;
    }

    pendingGemKey = null;
    editingSlotIndex = -1;
    makerPickerLabel.textContent = '촉진제 스탯 입력';
    makerPickerGrid.replaceChildren();
    makerPickerGrid.classList.add('maker-stimulant-input-panel');
    makerPicker.hidden = false;
    if (makerPickerBack instanceof HTMLElement) makerPickerBack.hidden = true;

    const existingStats = enhancementState.stimulantSlot?.stats ?? {};
    const statKeys = getStimulantStatKeys();
    stimulantValues = new Map();
    statKeys.forEach((key) => {
      stimulantValues.set(key, Number.isFinite(existingStats[key]) ? existingStats[key] : 0);
    });

    if (statKeys.length === 0) {
      const msg = document.createElement('p');
      msg.className = 'chaos-empty-message';
      msg.textContent = '적용할 스탯이 없습니다';
      makerPickerGrid.append(msg);
      return;
    }

    statKeys.forEach((key) => {
      const isHpMp = HP_MP_KEYS.has(key);
      const step = isHpMp ? 10 : 1;
      const limit = isHpMp ? 50 : 5;

      const row = document.createElement('div');
      row.className = 'chaos-stat-row maker-stimulant-stat-row';

      const label = document.createElement('span');
      label.className = 'chaos-stat-label';
      label.textContent = statLabelByKey[key] ?? key;

      const minMaxBtn = document.createElement('button');
      minMaxBtn.type = 'button';
      minMaxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
      minMaxBtn.textContent = 'MIN';
      minMaxBtn.addEventListener('click', () => {
        stimulantValues.set(key, -limit);
        updateStimulantStepperDisplay(row, key);
      });

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'chaos-stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        const cur = stimulantValues.get(key) ?? 0;
        if (cur > -limit) {
          stimulantValues.set(key, cur - step);
          updateStimulantStepperDisplay(row, key);
        }
      });

      const valueDisplay = document.createElement('span');
      valueDisplay.className = 'chaos-stepper-value maker-stimulant-stepper-value';
      const initialVal = stimulantValues.get(key) ?? 0;
      valueDisplay.textContent = initialVal > 0 ? `+${initialVal}` : String(initialVal);

      const plusBtn = document.createElement('button');
      plusBtn.type = 'button';
      plusBtn.className = 'chaos-stepper-btn';
      plusBtn.textContent = '+';
      plusBtn.addEventListener('click', () => {
        const cur = stimulantValues.get(key) ?? 0;
        if (cur < limit) {
          stimulantValues.set(key, cur + step);
          updateStimulantStepperDisplay(row, key);
        }
      });

      const maxBtn = document.createElement('button');
      maxBtn.type = 'button';
      maxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
      maxBtn.textContent = 'MAX';
      maxBtn.addEventListener('click', () => {
        stimulantValues.set(key, limit);
        updateStimulantStepperDisplay(row, key);
      });

      row.append(label, minMaxBtn, minusBtn, valueDisplay, plusBtn, maxBtn);
      makerPickerGrid.append(row);
    });

    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'chaos-apply-button maker-stimulant-apply-button';
    applyBtn.textContent = '적용';
    applyBtn.addEventListener('click', () => {
      const stats = {};
      for (const key of statKeys) {
        stats[key] = stimulantValues.get(key) ?? 0;
      }
      applyStimulant(enhancementState, stats);
      hidePicker();
      renderGemSlots();
      refreshEnhancedCard();
    });

    makerPickerGrid.append(applyBtn);
  };

  const renderStimulantSlot = () => {
    if (!(makerGemSlots instanceof HTMLElement)) return;

    const box = document.createElement('div');
    box.setAttribute('role', 'button');
    box.setAttribute('tabindex', '0');
    box.className = 'maker-gem-slot maker-gem-slot--stimulant';

    if (enhancementState?.stimulantSlot) {
      box.classList.add('maker-gem-slot--filled');

      const img = document.createElement('img');
      img.src = buildItemIconUrl(STIMULANT_ITEM_ID);
      img.alt = '';
      img.loading = 'lazy';

      const nameSpan = document.createElement('span');
      nameSpan.className = 'maker-gem-slot-name';
      nameSpan.textContent = '촉진제';

      box.append(img, nameSpan);

      const xBtn = document.createElement('span');
      xBtn.setAttribute('role', 'button');
      xBtn.setAttribute('tabindex', '0');
      xBtn.className = 'slot-box-x';
      xBtn.setAttribute('aria-label', '촉진제 슬롯 지우기');
      xBtn.textContent = '×';
      xBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        clearStimulant(enhancementState);
        stimulantValues = new Map();
        hidePicker();
        renderGemSlots();
        refreshEnhancedCard();
      });
      xBtn.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          xBtn.click();
        }
      });
      box.append(xBtn);
    }

    box.addEventListener('click', () => {
      pendingGemKey = null;
      editingSlotIndex = -1;
      renderGemSlots();
      renderStimulantInputPanel();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        box.click();
      }
    });

    makerGemSlots.append(box);
  };

  const renderGemSlots = () => {
    if (!(makerGemSlots instanceof HTMLElement) || !enhancementState) return;

    makerGemSlots.replaceChildren();
    renderStimulantSlot();

    for (let i = 0; i < SLOT_COUNT; i++) {
      const box = document.createElement('div');
      box.setAttribute('role', 'button');
      box.setAttribute('tabindex', '0');
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
          if (gem.behavior === 'variable') {
            const iconId = GEM_ITEM_IDS[gem.key]?.base ?? 0;
            const img = createGemIconElement(gem.key, gem.stat, iconId);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'maker-gem-slot-name';
            nameSpan.textContent = gem.nameKo;

            // Show non-zero stat deltas as a summary
            const statParts = [];
            for (const [key, value] of Object.entries(gemSlot.stats ?? {})) {
              if (value !== 0 && Number.isFinite(value)) {
                statParts.push(`${statLabelByKey[key] ?? key} ${value > 0 ? '+' : ''}${value}`);
              }
            }

            const statSpan = document.createElement('span');
            statSpan.className = 'maker-gem-slot-grade';
            statSpan.textContent = statParts.join(', ') || '적용됨';

            box.append(img, nameSpan, statSpan);
          } else {
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

        // × clear button — mirror scroll slot style
        const xBtn = document.createElement('span');
        xBtn.setAttribute('role', 'button');
        xBtn.setAttribute('tabindex', '0');
        xBtn.className = 'slot-box-x';
        xBtn.setAttribute('aria-label', `보석 슬롯 ${i + 1} 지우기`);
        xBtn.textContent = '×';
        xBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          revertGemSlot(enhancementState, i);
          hidePicker();
          renderGemSlots();
          refreshEnhancedCard();
        });
        xBtn.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            xBtn.click();
          }
        });
        box.append(xBtn);
      }

      if (!isDisabled || gemSlot) {
        box.addEventListener('click', () => {
          if (!enhancementState || isDisabled) return;

          // Filled or empty — select for editing / replacement.
          // × button is the only way to clear a slot.
          editingSlotIndex = i;
          renderGemSlots();
          renderStep1Picker();
        });
      }

      // Keyboard support
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          box.click();
        }
      });

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
    makerPickerGrid.classList.remove('maker-stimulant-input-panel');
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

      if (gem.key !== 'darkCrystal') {
        const statSpan = document.createElement('span');
        statSpan.className = 'maker-picker-item-stat';
        if (gem.behavior === 'variable') {
          const keyLabels = (gem.variableKeys ?? []).map((k) => statLabelByKey[k] ?? k);
          statSpan.textContent = `(${keyLabels.join('/')})`;
        } else {
          statSpan.textContent = `(${statLabelByKey[gem.stat] ?? gem.stat})`;
        }
        item.append(img, nameSpan, statSpan);
      } else {
        item.append(img, nameSpan);
      }

      if (!gem.disabled) {
        item.addEventListener('click', () => {
          pendingGemKey = gem.key;
          if (gem.behavior === 'variable') {
            renderVariableGemInputPanel(gem);
          } else {
            renderStep2Picker();
          }
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
    makerPickerGrid.classList.remove('maker-stimulant-input-panel');
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
      stimulantValues = new Map();
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
      makerGemArea.scrollIntoView({ behavior: 'smooth', block: 'start' });

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
      stimulantValues = new Map();
      hidePicker();

      if (makerSection instanceof HTMLElement) {
        makerSection.hidden = true;
      }
    },

    resetMakerUI() {
      hidePicker();
      stimulantValues = new Map();
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
