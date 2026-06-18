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
  requestMutation = (mutation) => mutation(),
  onMakerOpen,
  onStateChange,
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

  const hideStimulantEditor = () => {
    if (makerStimulantEditor instanceof HTMLElement) {
      makerStimulantEditor.hidden = true;
    }
    if (makerStimulantEditorGrid instanceof HTMLElement) {
      makerStimulantEditorGrid.replaceChildren();
    }
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

  const updateStimulantStepperDisplay = (rowEl, key, valuesMap = null) => {
    const valueDisplay = rowEl.querySelector('.maker-stimulant-stepper-value');
    if (!valueDisplay) return;

    const source = valuesMap ?? stimulantValues;
    const value = source.get(key) ?? 0;
    valueDisplay.textContent = value > 0 ? `+${value}` : String(value);
  };

  const renderVariableGemInputPanel = (gem, gradeIndex = 0) => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement) ||
        !enhancementState || !selectedBaseItem) {
      return;
    }

    const existingSlot = enhancementState.gemSlots.find((s) => s?.gemKey === gem.key);
    const existingMode = existingSlot?.mode;
    let currentIsProbability = existingMode === 'probability';

    const cleanStats = selectedBaseItem.stats ?? {};
    const statKeys = (gem.variableKeys ?? []).filter((k) => Number.isFinite(cleanStats[k]) && cleanStats[k] > 0);

    makerPickerLabel.textContent = `${gem.nameKo} 스탯 입력`;
    makerPickerGrid.replaceChildren();
    makerPickerGrid.classList.add('maker-stimulant-input-panel');
    makerPicker.hidden = false;
    if (makerPickerBack instanceof HTMLElement) makerPickerBack.hidden = false;

    const isDark = gem.key === 'darkCrystal';
    const gradeAbsLimit = isDark
      ? (gradeIndex === 2 ? 5 : gradeIndex === 1 ? 3 : 2)
      : (gradeIndex === 2 ? 3 : gradeIndex === 1 ? 2 : 1);
    const limit = gem.variableLimit ?? 5;
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
      const keyLimit = isHpMp ? 50 : (gradeAbsLimit ?? limit);

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
        updateStimulantStepperDisplay(row, key, values);
      });

      const minusBtn = document.createElement('button');
      minusBtn.type = 'button';
      minusBtn.className = 'chaos-stepper-btn';
      minusBtn.textContent = '−';
      minusBtn.addEventListener('click', () => {
        const cur = values.get(key) ?? 0;
        if (cur > -keyLimit) {
          values.set(key, cur - step);
          updateStimulantStepperDisplay(row, key, values);
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
          updateStimulantStepperDisplay(row, key, values);
        }
      });

      const maxBtn = document.createElement('button');
      maxBtn.type = 'button';
      maxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
      maxBtn.textContent = 'MAX';
      maxBtn.addEventListener('click', () => {
        values.set(key, keyLimit);
        updateStimulantStepperDisplay(row, key, values);
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
      const currentMode = currentIsProbability ? 'probability' : 'manual';
      requestMutation(() => {
        const ok = applyVariableGem(enhancementState, editingSlotIndex, gem.key, stats, currentMode, gradeIndex);
        if (!ok) return;

        pendingGemKey = null;

        let nextEmpty = -1;
        for (let i = 0; i < enhancementState.gemSlotCount; i++) {
          const s = i < enhancementState.gemSlots.length ? enhancementState.gemSlots[i] : null;
          if (!s) { nextEmpty = i; break; }
        }

        renderGemSlots();
        refreshEnhancedCard();
        onStateChange?.();

        if (nextEmpty >= 0) {
          editingSlotIndex = nextEmpty;
          renderGemSlots();
          renderStep1Picker();
        } else {
          hidePicker();
          renderGemSlots();
        }
      });
    });

    // Mode toggle row with actions
    const toggleRow = document.createElement('div');
    toggleRow.className = 'maker-mode-toggle-row';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'maker-mode-toggle-label';
    toggleLabel.textContent = '확률 계산에 포함';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'maker-mode-toggle-checkbox';
    checkbox.checked = currentIsProbability;
    checkbox.addEventListener('change', () => {
      currentIsProbability = checkbox.checked;
    });

    const helpIcon = document.createElement('span');
    helpIcon.className = 'maker-material-help';
    helpIcon.setAttribute('tabindex', '0');
    helpIcon.setAttribute('aria-label', '확률 계산 포함 설명');
    helpIcon.textContent = '?';
    const helpTooltip = document.createElement('span');
    helpTooltip.className = 'maker-material-help-tooltip';
    helpTooltip.setAttribute('role', 'tooltip');
    helpTooltip.textContent = gem.nameKo + ': 각 스텟 변동 확률 적용';
    helpIcon.append(helpTooltip);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'maker-mode-toggle-actions';
    if (makerPickerBack instanceof HTMLElement) {
      makerPickerBack.hidden = false;
      actionsDiv.append(makerPickerBack, applyBtn);
    } else {
      actionsDiv.append(applyBtn);
    }

    toggleLabel.prepend(checkbox);
    toggleLabel.append(' ', helpIcon);
    toggleRow.append(toggleLabel, actionsDiv);
    makerPickerGrid.append(toggleRow);
  };

  const renderStimulantInputPanel = () => {
    if (!(makerStimulantEditor instanceof HTMLElement) ||
        !(makerStimulantEditorGrid instanceof HTMLElement) ||
        !(makerStimulantEditorLabel instanceof HTMLElement) ||
        !enhancementState) {
      return;
    }

    const existingMode = enhancementState.stimulantSlot?.mode;
    let currentIsProbability = existingMode === 'probability';

    makerStimulantEditorLabel.textContent = '추가 옵션 스탯 입력';
    makerStimulantEditorGrid.replaceChildren();
    makerStimulantEditorGrid.classList.add('maker-stimulant-input-panel');
    makerStimulantEditor.hidden = false;

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
      makerStimulantEditorGrid.append(msg);
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
      makerStimulantEditorGrid.append(row);
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
      const currentMode = currentIsProbability ? 'probability' : 'manual';
      requestMutation(() => {
        applyStimulant(enhancementState, stats, currentMode);
        hideStimulantEditor();
        renderStimulantSlot();
        renderGemSlots();
        refreshEnhancedCard();
        onStateChange?.();
      });
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'chaos-apply-button maker-stimulant-cancel-button';
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', () => {
      hideStimulantEditor();
    });

    // Mode toggle row with actions
    const toggleRow = document.createElement('div');
    toggleRow.className = 'maker-mode-toggle-row';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'maker-mode-toggle-label';
    toggleLabel.textContent = '확률 계산에 포함';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'maker-mode-toggle-checkbox';
    checkbox.checked = currentIsProbability;
    checkbox.addEventListener('change', () => {
      currentIsProbability = checkbox.checked;
    });

    const helpIcon = document.createElement('span');
    helpIcon.className = 'maker-material-help';
    helpIcon.setAttribute('tabindex', '0');
    helpIcon.setAttribute('aria-label', '확률 계산 포함 설명');
    helpIcon.textContent = '?';
    const helpTooltip = document.createElement('span');
    helpTooltip.className = 'maker-material-help-tooltip';
    helpTooltip.setAttribute('role', 'tooltip');
    helpTooltip.textContent = '촉진제 확률 포함 (90% 성공률 + 각 스탯 확률)';
    helpIcon.append(helpTooltip);

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'maker-mode-toggle-actions';
    actionsDiv.append(cancelBtn, applyBtn);

    toggleLabel.prepend(checkbox);
    toggleLabel.append(' ', helpIcon);
    toggleRow.append(toggleLabel, actionsDiv);
    makerStimulantEditorGrid.append(toggleRow);
  };


  const renderStimulantSlot = () => {
    if (!(makerStimulantSlot instanceof HTMLElement)) return;

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
      const stimMode = enhancementState?.stimulantSlot?.mode;
      nameSpan.textContent = stimMode === 'probability' ? '촉진제' : '추옵';

      box.append(img, nameSpan);

      const xBtn = document.createElement('span');
      xBtn.setAttribute('role', 'button');
      xBtn.setAttribute('tabindex', '0');
      xBtn.className = 'slot-box-x';
      xBtn.setAttribute('aria-label', '촉진제 슬롯 지우기');
      xBtn.textContent = '×';
      xBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        requestMutation(() => {
          clearStimulant(enhancementState);
          stimulantValues = new Map();
          hideStimulantEditor();
          renderStimulantSlot();
          renderGemSlots();
          refreshEnhancedCard();
          onStateChange?.();
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

    box.addEventListener('click', () => {
      renderStimulantInputPanel();
    });
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        box.click();
      }
    });

    if (makerStimulantSlot instanceof HTMLElement) {
      makerStimulantSlot.replaceChildren();
      makerStimulantSlot.append(box);
    }
  };

  const hasMakerContributions = () =>
    enhancementState?.gemSlots?.some((s) => s !== null) ||
    enhancementState?.stimulantSlot !== null;

  const updateMakerToggleLabel = () => {
    if (!(makerToggle instanceof HTMLElement)) return;
    makerToggle.textContent = hasMakerContributions() ? '메이커 ✓' : '메이커';
  };

  const renderGemSlots = () => {
    if (!(makerGemSlots instanceof HTMLElement) || !enhancementState) return;

    makerGemSlots.replaceChildren();

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

      if (!isDisabled && editingSlotIndex === i) {
        box.classList.add('maker-gem-slot--active');
      }

      if (gemSlot) {
        box.classList.add('maker-gem-slot--filled');

        const gem = getGemTypeByKey(gemSlot.gemKey);
        if (gem) {
          if (gem.behavior === 'variable') {
            const gradeIdx = gemSlot.gradeIndex ?? 0;
            const gradeKey = gradeIdx === 2 ? 'high' : gradeIdx === 1 ? 'mid' : 'low';
            const iconId = GEM_ITEM_IDS[gem.key]?.[gradeKey] ?? GEM_ITEM_IDS[gem.key]?.base ?? 0;
            const img = createGemIconElement(gem.key, gem.stat, iconId);

            const nameSpan = document.createElement('span');
            nameSpan.className = 'maker-gem-slot-name';
            nameSpan.textContent = gem.nameKo;

            // Show grade with stat deltas: e.g. "상급 (A+2 M-1)"
            const statParts = [];
            for (const [key, value] of Object.entries(gemSlot.stats ?? {})) {
              if (value !== 0 && Number.isFinite(value)) {
                const label = statLabelByKey[key] ?? key;
                const shortLabel = label.length >= 3 ? label[0] : label;
                const signed = value > 0 ? `+${value}` : String(value);
                statParts.push(`${shortLabel}${signed}`);
              }
            }

            const gradeLabel = document.createElement('span');
            gradeLabel.className = 'maker-gem-slot-grade';
            const gradeName = GEM_GRADES[gradeIdx] ?? GEM_GRADES[0];
            gradeLabel.textContent = statParts.length > 0
              ? `${gradeName} (${statParts.join(' ')})`
              : gradeName;

            box.append(img, nameSpan, gradeLabel);
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
          requestMutation(() => {
            revertGemSlot(enhancementState, i);
            hidePicker();
            renderGemSlots();
            refreshEnhancedCard();
            onStateChange?.();
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
    updateMakerToggleLabel();
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
            renderVariableGemGradePicker(gem);
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

        requestMutation(() => {
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
          onStateChange?.();

          if (nextEmpty >= 0) {
            editingSlotIndex = nextEmpty;
            renderGemSlots();
            renderStep1Picker();
          } else {
            hidePicker();
            renderGemSlots();
          }
        });
      });

      makerPickerGrid.append(item);
    }
  };

  const renderVariableGemGradePicker = (gem) => {
    if (!(makerPicker instanceof HTMLElement) ||
        !(makerPickerGrid instanceof HTMLElement) ||
        !(makerPickerLabel instanceof HTMLElement)) {
      return;
    }

    makerPickerLabel.textContent = `등급 선택 — ${gem.nameKo}`;
    makerPickerGrid.replaceChildren();
    makerPickerGrid.classList.remove('maker-stimulant-input-panel');
    if (makerPickerBack instanceof HTMLElement) makerPickerBack.hidden = false;

    const isDarkCrystal = gem.key === 'darkCrystal';
    const gradeRanges = isDarkCrystal
      ? [
          { gradeIndex: 0, label: '하급', range: '-2 ~ +2' },
          { gradeIndex: 1, label: '중급', range: '-3 ~ +3' },
          { gradeIndex: 2, label: '상급', range: '-5 ~ +5' },
        ]
      : [
          { gradeIndex: 0, label: '하급', range: '-1 ~ +1' },
          { gradeIndex: 1, label: '중급', range: '-2 ~ +2' },
          { gradeIndex: 2, label: '상급', range: '-3 ~ +3' },
        ];

    for (let g = 2; g >= 0; g--) {
      const gradeInfo = gradeRanges[g];
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'maker-picker-item';

      const gradeKey = g === 2 ? 'high' : g === 1 ? 'mid' : 'low';
      const iconId = GEM_ITEM_IDS[gem.key]?.[gradeKey] ?? GEM_ITEM_IDS[gem.key]?.base ?? 0;
      const img = createGemIconElement(gem.key, gem.stat, iconId);

      const gradeSpan = document.createElement('span');
      gradeSpan.textContent = gradeInfo.label;

      const rangeSpan = document.createElement('span');
      rangeSpan.className = 'maker-picker-item-stat';
      rangeSpan.textContent = gradeInfo.range;

      item.append(img, gradeSpan, rangeSpan);

      item.addEventListener('click', () => {
        if (!enhancementState || editingSlotIndex < 0) return;
        pendingGemKey = gem.key;
        renderVariableGemInputPanel(gem, gradeInfo.gradeIndex);
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
      const stimArea = makerStimulantSlot?.closest('.maker-stimulant-area');
      if (stimArea instanceof HTMLElement) stimArea.hidden = true;
      hidePicker();
      hideStimulantEditor();
      renderGemSlots();
      refreshEnhancedCard();
      onStateChange?.();
      updateMakerToggleLabel();
    };

    const enableMaker = () => {
      if (enhancementState) {
        activateMaker(enhancementState);
      }
      onMakerOpen?.();
      makerToggle.classList.add('maker-toggle-button--active');
      if (makerGemArea instanceof HTMLElement) makerGemArea.hidden = false;
      const stimArea = makerStimulantSlot?.closest('.maker-stimulant-area');
      if (stimArea instanceof HTMLElement) stimArea.hidden = false;
      hidePicker();
      hideStimulantEditor();
      editingSlotIndex = -1;
      renderStimulantSlot();
      renderGemSlots();
      makerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      updateMakerToggleLabel();
    };

    makerToggle.addEventListener('click', () => {
      if (!enhancementState || makerToggle.disabled) return;

      if (enhancementState.makerActive) {
        if (hasMakerContributions()) {
          requestMutation(disableMaker);
        } else {
          disableMaker();
        }
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
      hidePicker();
      hideStimulantEditor();

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
        const stimAreaActive = makerStimulantSlot?.closest('.maker-stimulant-area');
        if (stimAreaActive instanceof HTMLElement) stimAreaActive.hidden = false;
        if (makerToggle instanceof HTMLElement) {
          makerToggle.classList.add('maker-toggle-button--active');
        }
        updateMakerToggleLabel();
        renderGemSlots();
        renderStimulantSlot();
      } else {
        if (makerGemArea instanceof HTMLElement) {
          makerGemArea.hidden = true;
        }
        const stimAreaInactive = makerStimulantSlot?.closest('.maker-stimulant-area');
        if (stimAreaInactive instanceof HTMLElement) stimAreaInactive.hidden = true;
        if (makerToggle instanceof HTMLElement) {
          makerToggle.classList.remove('maker-toggle-button--active');
          updateMakerToggleLabel();
        }
      }
    },

    deactivate() {
      enhancementState = null;
      selectedBaseItem = null;
      stimulantValues = new Map();
      hidePicker();
      hideStimulantEditor();

      if (makerSection instanceof HTMLElement) {
        makerSection.hidden = true;
      }
    },

    resetMakerUI() {
      hidePicker();
      hideStimulantEditor();
      stimulantValues = new Map();
      if (makerToggle instanceof HTMLElement) {
        makerToggle.classList.remove('maker-toggle-button--active');
        updateMakerToggleLabel();
        makerToggle.disabled = !enhancementState || enhancementState.gemSlotCount <= 0;
        if (makerSection instanceof HTMLElement) {
          makerSection.hidden = false;
        }
      }
      if (makerGemArea instanceof HTMLElement) {
        makerGemArea.hidden = true;
      }
      if (makerStimulantSlot instanceof HTMLElement) {
        makerStimulantSlot.replaceChildren();
      }
      if (makerGemSlots instanceof HTMLElement) {
        makerGemSlots.replaceChildren();
      }
    },

    refreshGemView() {
      renderGemSlots();
      refreshEnhancedCard();
    },

    closeMakerPanel() {
      if (!enhancementState || !enhancementState.makerActive) return;
      enhancementState.makerActive = false;
      stimulantValues = new Map();
      if (makerToggle instanceof HTMLElement) {
        makerToggle.classList.remove('maker-toggle-button--active');
        updateMakerToggleLabel();
      }
      if (makerGemArea instanceof HTMLElement) makerGemArea.hidden = true;
      const stimArea = makerStimulantSlot?.closest('.maker-stimulant-area');
      if (stimArea instanceof HTMLElement) stimArea.hidden = true;
      hidePicker();
      hideStimulantEditor();
      if (makerGemSlots instanceof HTMLElement) makerGemSlots.replaceChildren();
      refreshEnhancedCard();
    },
  };
}
