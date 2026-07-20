// ---- Item level-up total range editor UI builder ----

export function buildLevelUpSlotEditors({
  container,
  labelEl,
  selectedItem,
  deconAppliedLevelCount,
  itemLevelUpByItemId,
  levelUpTotalRanges,
  statLabelByKey,
  guardMutation,
  onStateChange,
}) {
  if (!(container instanceof globalThis.HTMLElement) || !(labelEl instanceof globalThis.HTMLElement)) return;
  container.replaceChildren();
  if (!selectedItem) return;

  const def = itemLevelUpByItemId.get(selectedItem.id);
  const maxLevelUps = Number.isInteger(def?.maxLevelUps) ? def.maxLevelUps : 0;
  if (maxLevelUps <= 0) return;

  const statRanges = def?.statRanges ?? {};
  const applied = deconAppliedLevelCount;

  if (applied <= 0) {
    labelEl.textContent = '아이템 레벨 +1 이상 설정 시 레벨업 총합 범위를 입력할 수 있습니다.';
    // Clear ranges in place
    Object.keys(levelUpTotalRanges).forEach((k) => delete levelUpTotalRanges[k]);
    return;
  }

  labelEl.textContent = `아이템 레벨 +${applied} 레벨업 총합 범위:`;

  const slot = document.createElement('div');
  slot.className = 'decon-level-slot';
  slot.setAttribute('data-decon-level-total-range', String(applied));

  const statsRow = document.createElement('div');
  statsRow.className = 'decon-level-slot-stats';

  for (const key of Object.keys(statRanges)) {
    const defRange = statRanges[key] ?? { min: 0, max: 0 };
    const totalMin = defRange.min * applied;
    const totalMax = defRange.max * applied;
    if (!levelUpTotalRanges[key]) {
      levelUpTotalRanges[key] = { min: totalMin, max: totalMax };
    }

    const range = levelUpTotalRanges[key];

    const row = document.createElement('div');
    row.className = 'decon-secondary-stimulant-row';

    const label = document.createElement('span');
    label.className = 'decon-secondary-stimulant-stat';
    label.textContent = statLabelByKey[key] || key;
    row.append(label);

    const dualWrap = document.createElement('span');
    dualWrap.className = 'dual-range';

    const minSlider = document.createElement('input');
    minSlider.type = 'range';
    minSlider.min = totalMin;
    minSlider.max = totalMax;
    minSlider.step = 1;
    minSlider.value = range.min;

    const maxSlider = document.createElement('input');
    maxSlider.type = 'range';
    maxSlider.min = totalMin;
    maxSlider.max = totalMax;
    maxSlider.step = 1;
    maxSlider.value = range.max;

    dualWrap.append(minSlider, maxSlider);

    const minVal = document.createElement('span');
    minVal.className = 'decon-secondary-stimulant-value';
    minVal.textContent = String(range.min);

    const sep = document.createElement('span');
    sep.className = 'decon-secondary-stimulant-sep';
    sep.textContent = '~';

    const maxVal = document.createElement('span');
    maxVal.className = 'decon-secondary-stimulant-value';
    maxVal.textContent = String(range.max);

    minSlider.addEventListener('input', () => {
      const val = Number(minSlider.value);
      minVal.textContent = String(val);
      const clamped = Math.min(val, levelUpTotalRanges[key].max);
      minSlider.value = clamped;
    });
    minSlider.addEventListener('change', () => {
      const val = Number(minSlider.value);
      const clamped = Math.min(val, levelUpTotalRanges[key].max);
      const savedBounds = levelUpTotalRanges[key]
        ? { ...levelUpTotalRanges[key] }
        : { min: 0, max: 0 };
      guardMutation(() => {
        levelUpTotalRanges[key] = { ...levelUpTotalRanges[key], min: clamped };
        minSlider.value = clamped;
        minVal.textContent = String(clamped);
        if (onStateChange) onStateChange();
      }, () => {
        minSlider.value = savedBounds.min;
        minVal.textContent = String(savedBounds.min);
      });
    });

    maxSlider.addEventListener('input', () => {
      const val = Number(maxSlider.value);
      maxVal.textContent = String(val);
      const clamped = Math.max(val, levelUpTotalRanges[key].min);
      maxSlider.value = clamped;
    });
    maxSlider.addEventListener('change', () => {
      const val = Number(maxSlider.value);
      const clamped = Math.max(val, levelUpTotalRanges[key].min);
      const savedBounds = levelUpTotalRanges[key]
        ? { ...levelUpTotalRanges[key] }
        : { min: 0, max: 0 };
      guardMutation(() => {
        levelUpTotalRanges[key] = { ...levelUpTotalRanges[key], max: clamped };
        maxSlider.value = clamped;
        maxVal.textContent = String(clamped);
        if (onStateChange) onStateChange();
      }, () => {
        maxSlider.value = savedBounds.max;
        maxVal.textContent = String(savedBounds.max);
      });
    });

    row.append(dualWrap, minVal, sep, maxVal);
    statsRow.append(row);
  }

  slot.append(statsRow);
  container.append(slot);
}
