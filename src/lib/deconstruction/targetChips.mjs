/**
 * Deconstruction target-stat chip UI.
 *
 * Renders the checkbox "chips" that let the user pick which stats to
 * target in the deconstruction calculation.  Extracted from
 * deconstruction.astro.
 */

/**
 * Build the target-stat chip checkboxes inside `deconTargetChips`.
 *
 * Chips are rendered for every stat present on the base item or in the
 * current deltas.  Core stats are always visible; non-core stats only
 * appear when they have a non-zero delta.
 *
 * @param {object} opts
 * @param {HTMLElement} opts.container - the target-chips DOM element
 * @param {object|null} opts.selectedItem - currently selected item
 * @param {string[]} opts.deconStatKeys - active stat keys
 * @param {Record<string,number>} opts.deconDeltas - current deltas
 * @param {string[]} opts.STAT_ORDER - sort order for stat keys
 * @param {Set<string>} opts.CORE_STATS - core stat key set
 * @param {Record<string,string>} opts.statLabelByKey - Korean labels
 * @param {(checkbox:HTMLInputElement, guardFn:Function, onSuccess:Function) => void} opts.guardCheckboxMutation
 * @param {(fn:Function) => void} opts.guardDeconMutation
 * @param {() => void} opts.updateAnalyzeButton
 */
export function renderTargetChips({
  container,
  selectedItem,
  deconStatKeys,
  deconDeltas,
  STAT_ORDER,
  CORE_STATS,
  statLabelByKey,
  guardCheckboxMutation,
  guardDeconMutation,
  updateAnalyzeButton,
}) {
  if (!(container instanceof HTMLElement)) return;
  container.replaceChildren();

  // Collect all keys: base item stats + deltas
  const allKeys = new Set([
    ...Object.keys(selectedItem?.stats ?? {}),
    ...deconStatKeys.filter(k => deconDeltas[k] !== 0),
  ]);

  // Sort by card order
  const sortedKeys = [...allKeys].sort((a, b) => {
    const ai = STAT_ORDER.indexOf(a);
    const bi = STAT_ORDER.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const key of sortedKeys) {
    if (key === 'attackSpeed' || key === 'upgradeSlots') continue;

    const isCore = CORE_STATS.has(key);
    const delta = deconDeltas[key] ?? 0;

    // Core: visible if on base item OR has delta
    // Non-core: visible only if has non-zero delta
    if (!isCore && delta === 0) continue;

    const label = document.createElement('label');
    label.className = 'ev-target-chip';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.deconTargetKey = key;
    checkbox.checked = delta !== 0;

    checkbox.addEventListener('change', () => {
      guardCheckboxMutation(checkbox, guardDeconMutation, updateAnalyzeButton);
    });

    const chipLabel = document.createElement('span');
    chipLabel.className = 'ev-target-chip-label';
    const displayName = statLabelByKey[key] || key;
    chipLabel.textContent = delta !== 0
      ? `${displayName} ${delta > 0 ? '+' : ''}${delta}`
      : `${displayName} 유지`;

    label.append(checkbox, chipLabel);
    container.append(label);
  }

  updateAnalyzeButton();
}

/**
 * Read the currently checked target stat keys from the chips container.
 *
 * @param {HTMLElement} container - the target-chips DOM element
 * @returns {string[]} checked stat keys
 */
export function getCheckedTargetKeys(container) {
  if (!(container instanceof HTMLElement)) return [];
  const checkboxes = container.querySelectorAll('input:checked');
  return [...checkboxes].map(cb => cb.dataset.deconTargetKey).filter(Boolean);
}
