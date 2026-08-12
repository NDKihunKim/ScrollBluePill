/**
 * Deconstruction stat-editor UI builders.
 *
 * Extracted from deconstruction.astro to keep the page script focused on
 * orchestration rather than DOM construction.  All functions accept their
 * dependencies as explicit parameters — no hidden closure over page globals.
 */
import { HP_MP_KEYS } from '../enhancementState.mjs';

// ── Stat input mode helpers ──────────────────────────────────

/**
 * Value shown in the editor input for a stored delta.
 * 'add' mode: input is the delta itself; 'sum' mode: input is the
 * final stat (clean base + delta), so a clean stat shows as-is.
 */
export const statDisplayValue = (mode, base, delta) => (mode === 'sum' ? base + delta : delta);

/**
 * Inverse of statDisplayValue: convert an entered input value back
 * to the stored delta.
 */
export const statDeltaFromDisplay = (mode, base, value) => (mode === 'sum' ? value - base : value);

// ── Label equalization ────────────────────────────────────────

/**
 * Measure the widest label in `container` matching `labelSelector`,
 * then set min-width on all of them to that value so they align.
 * Pure DOM utility — no page-state dependencies.
 */
export function equalizeGroupLabels(container, labelSelector) {
  if (!(container instanceof HTMLElement)) return;
  const labels = container.querySelectorAll(labelSelector);
  if (labels.length === 0) return;

  // Reset all labels to auto so we measure natural widths
  for (const label of labels) {
    if (label instanceof HTMLElement) {
      label.style.minWidth = '';
    }
  }

  // Measure
  let maxWidth = 0;
  for (const label of labels) {
    const w = label.getBoundingClientRect().width;
    if (w > maxWidth) maxWidth = w;
  }

  // Apply
  const px = Math.ceil(maxWidth) + 'px';
  for (const label of labels) {
    if (label instanceof HTMLElement) {
      label.style.minWidth = px;
    }
  }
}

// ── Stat editor ───────────────────────────────────────────────

/**
 * Rebuild the deconstruction stat editor UI from the current stat keys
 * and deltas.  Each row shows a label, -/+, MIN/MAX steppers, and a
 * numeric input.
 *
 * Callbacks let the page wire up the circular dependency between this
 * function and populateAddStatList without introducing module-level cycles.
 */
export function rebuildStatEditor({
  deconStatEditor,
  deconStatKeys,
  STAT_ORDER,
  deconDeltas,
  statLabelByKey,
  deconSlotState,
  selectedItem,
  setStatDelta,
  deconBasicStatsSep,
  populateAddStatList,
  renderTargetChips,
  updateTargetCard,
  checkStarState,
  deconStatMode = 'add',
}) {
  if (!(deconStatEditor instanceof HTMLElement)) return;
  deconStatEditor.replaceChildren();

  // Sort keys to match the item card order
  deconStatKeys.sort((a, b) => {
    const ai = STAT_ORDER.indexOf(a);
    const bi = STAT_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const k of deconStatKeys) {
    // Only init delta for newly-added keys; preserve existing edits
    if (!(k in deconDeltas)) {
      deconDeltas[k] = 0;
    }

    const row = document.createElement('div');
    row.className = 'chaos-stat-row';
    row.dataset.deconStatKey = k;

    const label = document.createElement('span');
    label.className = 'chaos-stat-label';
    label.textContent = statLabelByKey[k] || k;

    const isHpMp = HP_MP_KEYS.has(k);
    const stepSize = isHpMp ? 10 : 1;
    const perScrollMax = isHpMp ? 50 : 5;
    const scrollRange = Math.min(100, deconSlotState.maxSlots * perScrollMax);
    const rangeMax = scrollRange;
    const baseValue = selectedItem?.stats?.[k] ?? 0;
    // Floor is slot-derived like the ceiling, but the final stat can never
    // drop below 0, so the delta can't remove more than the base stat.
    const rangeMin = Math.max(-scrollRange, -baseValue);

    const minBtn = document.createElement('button');
    minBtn.type = 'button';
    minBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
    minBtn.textContent = 'MIN';
    minBtn.addEventListener('click', () => {
      setStatDelta(k, rangeMin);
    });

    const decBtn = document.createElement('button');
    decBtn.type = 'button';
    decBtn.className = 'chaos-stepper-btn';
    decBtn.textContent = '-';
    decBtn.addEventListener('click', () => {
      setStatDelta(k, Math.max(rangeMin, deconDeltas[k] - stepSize));
    });

    const valueInput = document.createElement('input');
    valueInput.type = 'number';
    valueInput.className = 'chaos-stepper-value';
    valueInput.dataset.deconStatValue = k;
    valueInput.value = String(
      statDisplayValue(deconStatMode, baseValue, deconDeltas[k] ?? 0),
    );
    valueInput.addEventListener('input', () => {
      const raw = parseInt(valueInput.value, 10);
      if (Number.isFinite(raw)) {
        const rawDelta = statDeltaFromDisplay(deconStatMode, baseValue, raw);
        const clamped = Math.max(rangeMin, Math.min(rangeMax, rawDelta));
        // Store the clamped delta but never rewrite the field while the
        // user is typing — mid-input value writes fight mobile keyboards.
        setStatDelta(k, clamped, { fromInput: true });
      }
    });

    // Snap the display to the clamped state once editing ends.
    valueInput.addEventListener('blur', () => {
      valueInput.value = String(
        statDisplayValue(deconStatMode, baseValue, deconDeltas[k] ?? 0),
      );
    });

    const incBtn = document.createElement('button');
    incBtn.type = 'button';
    incBtn.className = 'chaos-stepper-btn';
    incBtn.textContent = '+';
    incBtn.addEventListener('click', () => {
      setStatDelta(k, Math.min(rangeMax, deconDeltas[k] + stepSize));
    });

    const maxBtn = document.createElement('button');
    maxBtn.type = 'button';
    maxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
    maxBtn.textContent = 'MAX';
    maxBtn.addEventListener('click', () => {
      setStatDelta(k, rangeMax);
    });

    row.append(label, minBtn, decBtn, valueInput, incBtn, maxBtn);
    deconStatEditor.append(row);
  }

  // Equalize label widths in the 기본 스탯 group
  equalizeGroupLabels(deconStatEditor, '.chaos-stat-label');
  if (deconBasicStatsSep instanceof HTMLElement) deconBasicStatsSep.hidden = false;

  // Populate add-stat menu
  populateAddStatList();
  renderTargetChips();
  updateTargetCard();
  checkStarState();
}

// ── Add-stat menu ─────────────────────────────────────────────

/**
 * Populate the "add stat" dropdown with stats that aren't already in
 * the editor.  Calls `rebuildStatEditor` when the user picks one.
 */
export function populateAddStatList({
  deconAddStatList,
  deconStatKeys,
  STAT_PRIORITY,
  statLabelByKey,
  guardDeconMutation,
  deconDeltas,
  rebuildStatEditor,
  deconAddStatToggle,
}) {
  if (!(deconAddStatList instanceof HTMLElement)) return;
  deconAddStatList.replaceChildren();

  const deconStatSet = new Set(deconStatKeys);
  let hasOptions = false;

  for (const key of STAT_PRIORITY) {
    if (deconStatSet.has(key)) continue;
    hasOptions = true;

    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'decon-add-stat-option';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = statLabelByKey[key] || key;

    row.append(nameSpan);
    row.addEventListener('click', () =>
      guardDeconMutation(() => {
        deconDeltas[key] = 0;
        deconStatKeys.push(key);
        rebuildStatEditor();
        // Collapse list after selection
        if (deconAddStatList instanceof HTMLElement) deconAddStatList.hidden = true;
        if (deconAddStatToggle instanceof HTMLElement)
          deconAddStatToggle.classList.remove('decon-add-stat-toggle--open');
      }),
    );

    deconAddStatList.append(row);
  }

  // Hide toggle if no options remain
  if (deconAddStatToggle instanceof HTMLElement) {
    deconAddStatToggle.hidden = !hasOptions;
  }
}
