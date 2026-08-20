/**
 * Session-scoped auto-persistence for the deconstruction page.
 *
 * Saves the full page state to sessionStorage before navigation away so that
 * browser Back/Forward and refresh can restore the prior user-visible state
 * without re-running the calculation manually.
 *
 * Uses sessionStorage (not localStorage) so state auto-expires when the tab
 * closes — a new tab visit always gets a clean slate.
 */

/** sessionStorage key for the auto-save payload. */
const SESSION_KEY = 'deconSession:v1';

/** Separate key for the heavy result payload — isolated so quota
 *  overflow in the result does not kill the lightweight draft state. */
const RESULT_KEY = 'deconResult:v1';

/**
 * Save the full deconstruction page state to sessionStorage.
 *
 * @param {object} state - Serialisable page state object
 */
export function saveDeconSession(state) {
  try {
    const payload = {
      v: 1,
      timestamp: new Date().toISOString(),
      ...state,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage unavailable or full — silently continue
  }
}

/**
 * Read the saved deconstruction session state from sessionStorage.
 * Does NOT consume (delete) the entry — it persists for subsequent
 * Back navigations and refreshes.
 *
 * @returns {object|null} The parsed state object, or null if absent or invalid
 */
export function loadDeconSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (!payload || !payload.v || payload.v < 1) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return payload;
  } catch {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // best effort
    }
    return null;
  }
}

/**
 * Remove the saved deconstruction session state from sessionStorage.
 * Call when the user starts a fresh calculation so stale state does not
 * reappear on the next page load.
 */
export function clearDeconSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // best effort
  }
}

/**
 * Read the saved deconstruction result from sessionStorage (separate key).
 * Does NOT consume the entry.
 * @returns {object|null} The parsed result object, or null if absent or invalid
 */
export function loadDeconResult() {
  try {
    const raw = sessionStorage.getItem(RESULT_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (!payload || !payload.v || payload.v < 1) {
      sessionStorage.removeItem(RESULT_KEY);
      return null;
    }
    return payload.result ?? null;
  } catch {
    try { sessionStorage.removeItem(RESULT_KEY); } catch { /* best effort */ }
    return null;
  }
}

/**
 * Remove the saved deconstruction result from sessionStorage.
 */
export function clearDeconResult() {
  try {
    sessionStorage.removeItem(RESULT_KEY);
  } catch {
    // best effort
  }
}

/**
 * Build a serialisable snapshot of the deconstruction page state — the shape
 * shared by sessionStorage auto-save and share links.
 *
 * All mutable state (Sets, Maps, objects) is shallow-cloned before storage
 * so later mutations don't corrupt the saved snapshot.
 *
 * `scrollPosition` is deliberately excluded — it is session-local only and
 * meaningless to a share-link recipient.
 *
 * @param {object} opts
 * @param {object} opts.selectedItem - currently selected item
 * @param {HTMLInputElement|null} opts.itemNameInput - item name input
 * @param {Record<string,number>} opts.deconDeltas - stat delta map
 * @param {string[]} opts.deconStatKeys - active stat keys
 * @param {'add'|'sum'} opts.deconStatMode - stat editor input mode
 * @param {{successfulScrollCount:number,remainingSlots:number,maxSlots:number}} opts.slotState
 * @param {number} opts.totalAppliedScrolls - successful + inferred failed
 * @param {number} opts.appliedLevelCount - item level-up count
 * @param {Set<string>} opts.scrollRateFilter - active rate filter
 * @param {Record<string,{min:number,max:number}>} opts.stimulantBoundsMap - stimulant bounds
 * @param {string[]} opts.stimulantEnabledKeys
 * @param {Record<string,{min:number,max:number}>} opts.chaosBoundsMap - chaos bounds
 * @param {string[]} opts.chaosEnabledKeys
 * @param {Set<number>|null} opts.gemFilter
 * @param {Record<string,{min:number,max:number}>} opts.levelUpTotalRanges
 * @param {() => string[]} opts.getCheckedTargetKeys
 * @param {{scrolls:HTMLInputElement,stimulant:HTMLInputElement,gems:HTMLInputElement,itemLevelUp:HTMLInputElement}} opts.sourceInputs
 * @returns {object} serialisable snapshot
 */
export function collectDeconState({
  selectedItem,
  itemNameInput,
  deconDeltas,
  deconStatKeys,
  deconStatMode,
  slotState,
  totalAppliedScrolls,
  appliedLevelCount,
  scrollRateFilter,
  stimulantBoundsMap,
  stimulantEnabledKeys,
  chaosBoundsMap,
  chaosEnabledKeys,
  gemFilter,
  levelUpTotalRanges,
  getCheckedTargetKeys,
  sourceInputs,
}) {
  return {
    itemId: selectedItem.id,
    itemName:
      itemNameInput instanceof HTMLInputElement ? itemNameInput.value : (selectedItem.nameKo ?? ''),
    deconDeltas: { ...deconDeltas },
    deconStatKeys: [...deconStatKeys],
    deconStatMode,
    successfulScrollCount: slotState.successfulScrollCount,
    remainingSlots: slotState.remainingSlots,
    maxSlots: slotState.maxSlots,
    totalAppliedScrolls,
    appliedLevelCount,
    scrollRateFilter: [...scrollRateFilter],
    stimulantBoundsMap: structuredClone(stimulantBoundsMap),
    stimulantEnabledKeys: [...stimulantEnabledKeys],
    chaosBoundsMap: structuredClone(chaosBoundsMap),
    chaosEnabledKeys: [...chaosEnabledKeys],
    gemFilter: gemFilter instanceof Set ? [...gemFilter] : null,
    levelUpTotalRanges: structuredClone(levelUpTotalRanges),
    targetKeys: getCheckedTargetKeys(),
    sourceChecked: {
      scrolls:
        sourceInputs.scrolls instanceof HTMLInputElement ? sourceInputs.scrolls.checked : false,
      stimulant:
        sourceInputs.stimulant instanceof HTMLInputElement ? sourceInputs.stimulant.checked : false,
      gems: sourceInputs.gems instanceof HTMLInputElement ? sourceInputs.gems.checked : false,
      itemLevelUp:
        sourceInputs.itemLevelUp instanceof HTMLInputElement
          ? sourceInputs.itemLevelUp.checked
          : false,
    },
  };
}

/**
 * Build and persist a full deconstruction-page snapshot for back-navigation
 * restoration.  Used by the transfer-payload handler and other save points.
 *
 * @param {object} opts - same shape as collectDeconState (see its JSDoc)
 */
export function saveDeconTransferSession(opts) {
  saveDeconSession({
    ...collectDeconState(opts),
    scrollPosition: window.scrollY,
  });

  // Save the heavy result payload to a separate key — best-effort only.
  // If the result exceeds the sessionStorage quota, the lightweight draft
  // state (saved above) is unaffected.
  const result = window.__lastDeconResult;
  if (result) {
    try {
      sessionStorage.setItem(RESULT_KEY, JSON.stringify({ v: 1, result }));
    } catch {
      // quota exceeded — draft state already saved, silently ok
    }
  }
}
