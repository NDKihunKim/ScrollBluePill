// ---- Slot bar UI helpers for deconstruction page ----

/**
 * Build the page state object for slot save/compare.
 * Reads current item + stat configuration.
 */
export function buildDeconPageState({ selectedItem, deconStatKeys, deconDeltas, deconSlotState, deconAppliedLevelCount }) {
  if (!selectedItem) return null;
  // Strip zero entries — rebuildStatEditor seeds missing keys as 0,
  // which would otherwise break slot match after load
  const deltas = {};
  for (const key of deconStatKeys) {
    const value = deconDeltas[key];
    if (value !== 0 && Number.isFinite(value)) deltas[key] = value;
  }
  return {
    itemId: selectedItem.id,
    deconDeltas: deltas,
    successfulScrollCount: deconSlotState.successfulScrollCount,
    deconStatKeys: [...deconStatKeys],
    remainingSlots: deconSlotState.remainingSlots,
    appliedLevelCount: deconAppliedLevelCount,
  };
}

/**
 * Update the star (★/☆) indicator based on whether current state
 * matches a saved slot.
 */
export function checkDeconStarState({ selectedItem, deconStar, buildPageState, findMatchingSlot }) {
  if (!selectedItem || !(deconStar instanceof globalThis.HTMLElement)) return;
  const state = buildPageState();
  if (!state) {
    deconStar.textContent = '☆';
    deconStar.classList.remove('item-card-star--saved');
    return;
  }
  const match = findMatchingSlot('deconstruction', state);
  if (match >= 0) {
    deconStar.textContent = '★';
    deconStar.classList.add('item-card-star--saved');
  } else {
    deconStar.textContent = '☆';
    deconStar.classList.remove('item-card-star--saved');
  }
}

/**
 * Render the slot bar with filled/empty boxes.
 * Calls onLoadSlot(slotIndex) when a filled slot is clicked,
 * and onDeleteSlot(slotIndex, callback) when the × button is clicked.
 */
export function renderDeconSlotBar({ deconSlotBar, readSlots, MAX_SLOTS, buildItemIconUrl, onLoadSlot, onDeleteSlot }) {
  if (!(deconSlotBar instanceof globalThis.HTMLElement)) return;
  const slots = readSlots('deconstruction');
  deconSlotBar.replaceChildren();
  for (let i = 0; i < MAX_SLOTS; i++) {
    const s = slots[i];
    const box = document.createElement('div');
    box.className = s ? 'item-slot item-slot--filled' : 'item-slot item-slot--empty';
    if (s) {
      const icon = document.createElement('img');
      icon.src = buildItemIconUrl(s.item.iconId);
      icon.alt = s.item.nameKo;
      box.append(icon);
      box.title = s.item.nameKo;
      box.addEventListener('click', () => onLoadSlot(i));

      const xBtn = document.createElement('button');
      xBtn.type = 'button';
      xBtn.className = 'item-slot-x';
      xBtn.textContent = '×';
      xBtn.addEventListener('click', (e) => { e.stopPropagation(); onDeleteSlot(i); });
      box.append(xBtn);
    }
    deconSlotBar.append(box);
  }
}
