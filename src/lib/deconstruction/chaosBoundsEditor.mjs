// ---- Chaos scroll bounds editor UI builder ----

export function buildChaosBoundsEditor({
  container,
  selectedItem,
  deconStatKeys,
  deconDeltas,
  boundsMap,
  enabledKeys,
  shadow,
  statLabelByKey,
  HP_MP_KEYS,
  getCheckedTargetKeys,
  guardMutation,
  onStateChange,
}) {
  if (!(container instanceof globalThis.HTMLElement)) return;
  container.replaceChildren();

  const hasExisting = Object.keys(boundsMap).length > 0;
  if (!hasExisting) {
    Object.keys(boundsMap).forEach((k) => delete boundsMap[k]);
    enabledKeys.clear();
  }

  // Only show stats that have a target delta set (non-zero)
  const targetedKeys = deconStatKeys.filter((k) => deconDeltas[k] !== 0);
  const checkedTargetKeys = new Set(getCheckedTargetKeys());

  for (const key of targetedKeys) {
    const isHpMp = HP_MP_KEYS.has(key);
    const defaultLimit = isHpMp ? 50 : 5;
    const stepSize = isHpMp ? 10 : 1;
    const defaultChecked = checkedTargetKeys.has(key);

    if (defaultChecked && !(key in boundsMap)) {
      boundsMap[key] = { min: -defaultLimit, max: defaultLimit };
      if (!hasExisting) enabledKeys.add(key);
    }

    const row = document.createElement('div');
    row.className = 'decon-secondary-stimulant-row';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'decon-stimulant-checkbox';
    checkbox.checked = defaultChecked;

    const label = document.createElement('span');
    label.className = 'decon-secondary-stimulant-stat';
    label.textContent = statLabelByKey[key] || key;

    // Dual-range slider (two thumbs overlaid on one track)
    const chaosDualWrap = document.createElement('span');
    chaosDualWrap.className = 'decon-chaos-dual-range';

    const minSlider = document.createElement('input');
    minSlider.type = 'range';
    minSlider.min = -defaultLimit;
    minSlider.max = defaultLimit;
    minSlider.step = stepSize;
    minSlider.value = 0;
    minSlider.disabled = !defaultChecked;

    const maxSlider = document.createElement('input');
    maxSlider.type = 'range';
    maxSlider.min = -defaultLimit;
    maxSlider.max = defaultLimit;
    maxSlider.step = stepSize;
    maxSlider.value = defaultLimit;
    maxSlider.disabled = !defaultChecked;

    chaosDualWrap.append(minSlider, maxSlider);

    const minVal = document.createElement('span');
    minVal.className = 'decon-secondary-stimulant-value';
    minVal.textContent = '0';

    const sep = document.createElement('span');
    sep.className = 'decon-secondary-stimulant-sep';
    sep.textContent = '~';

    const maxVal = document.createElement('span');
    maxVal.className = 'decon-secondary-stimulant-value';
    maxVal.textContent = String(defaultLimit);

    const applyCheckboxState = (checked) => {
      minSlider.disabled = !checked;
      maxSlider.disabled = !checked;
      if (checked) {
        const restored = shadow[key];
        const mn = restored ? restored.min : -defaultLimit;
        const mx = restored ? restored.max : defaultLimit;
        minSlider.value = mn;
        maxSlider.value = mx;
        minVal.textContent = String(mn);
        maxVal.textContent = String(mx);
        boundsMap[key] = { min: mn, max: mx };
        enabledKeys.add(key);
        delete shadow[key];
        row.classList.remove('decon-secondary-stimulant-row--disabled');
      } else {
        const mn = Number(minSlider.value);
        const mx = Number(maxSlider.value);
        shadow[key] = { min: mn, max: mx };
        delete boundsMap[key];
        enabledKeys.delete(key);
        row.classList.add('decon-secondary-stimulant-row--disabled');
      }
      if (onStateChange) onStateChange();
    };

    if (!defaultChecked) {
      row.classList.add('decon-secondary-stimulant-row--disabled');
    }

    checkbox.addEventListener('change', () => {
      const nextChecked = checkbox.checked;
      checkbox.checked = !nextChecked;
      guardMutation(() => {
        checkbox.checked = nextChecked;
        applyCheckboxState(nextChecked);
      });
    });

    const updateBounds = () => {
      let mn = Number(minSlider.value);
      let mx = Number(maxSlider.value);
      if (mn > mx) [mn, mx] = [mx, mn];
      minSlider.value = mn;
      maxSlider.value = mx;
      minVal.textContent = String(mn);
      maxVal.textContent = String(mx);
    };
    minSlider.addEventListener('input', updateBounds);
    maxSlider.addEventListener('input', updateBounds);
    minSlider.addEventListener('change', () => {
      let mn = Number(minSlider.value);
      let mx = Number(maxSlider.value);
      if (mn > mx) [mn, mx] = [mx, mn];
      const savedKey = key;
      const savedBounds = boundsMap[savedKey]
        ? { min: boundsMap[savedKey].min, max: boundsMap[savedKey].max }
        : { min: 0, max: defaultLimit };
      guardMutation(() => {
        boundsMap[savedKey] = { min: mn, max: mx };
        minVal.textContent = String(mn);
        maxVal.textContent = String(mx);
        if (onStateChange) onStateChange();
      }, () => {
        minSlider.value = savedBounds.min;
        maxSlider.value = savedBounds.max;
        minVal.textContent = String(savedBounds.min);
        maxVal.textContent = String(savedBounds.max);
      });
    });
    maxSlider.addEventListener('change', () => {
      // minSlider change handler already handles both sliders
    });

    row.append(checkbox, label, chaosDualWrap, minVal, sep, maxVal);
    container.append(row);
  }
}
