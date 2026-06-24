# Item Card Save Slots — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 save/bookmark slots beside the item card on both calculator pages, with star button save, slot picker overlay, load/delete flows, and localStorage persistence.

**Architecture:** A shared `itemSlotStore.mjs` module handles all persistence logic. Each page integrates slot bar HTML, star button, save picker overlay, and delete confirmation. State matching determines whether the star shows filled (★) or outline (☆).

**Tech Stack:** Vanilla JS, localStorage, Astro `.astro` SFC templates, scoped+global CSS

---

### Task 1: Create shared `itemSlotStore.mjs` module

**Files:**
- Create: `src/lib/itemSlotStore.mjs`

- [ ] **Step 1: Create the module**

```js
const STORAGE_PREFIX = 'itemSlots:v1:';
const MAX_SLOTS = 4;

/**
 * Read all slots for a page.
 * @param {string} page - 'deconstruction' | 'expectedValue'
 * @returns {Array<{item: object, savedAt: string, pageState: object}|null>}
 */
export function readSlots(page) {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + page);
    if (!raw) return Array(MAX_SLOTS).fill(null);
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return Array(MAX_SLOTS).fill(null);
    // Normalize to exactly MAX_SLOTS
    const slots = Array(MAX_SLOTS).fill(null);
    for (let i = 0; i < Math.min(MAX_SLOTS, parsed.length); i++) {
      slots[i] = parsed[i] ?? null;
    }
    return slots;
  } catch {
    return Array(MAX_SLOTS).fill(null);
  }
}

/**
 * Write all slots for a page.
 */
export function writeSlots(page, slots) {
  try {
    localStorage.setItem(STORAGE_PREFIX + page, JSON.stringify(slots));
  } catch (e) {
    console.error('itemSlotStore: failed to write slots', e);
  }
}

/**
 * Save to a specific slot index.
 */
export function saveToSlot(page, slotIndex, item, pageState) {
  const slots = readSlots(page);
  if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return false;
  slots[slotIndex] = {
    item: { id: item.id, nameKo: item.nameKo, equipmentKind: item.equipmentKind, requiredLevel: item.requiredLevel, iconId: item.id },
    savedAt: new Date().toISOString(),
    pageState,
  };
  writeSlots(page, slots);
  return true;
}

/**
 * Clear a slot.
 */
export function clearSlot(page, slotIndex) {
  const slots = readSlots(page);
  if (slotIndex < 0 || slotIndex >= MAX_SLOTS) return;
  slots[slotIndex] = null;
  writeSlots(page, slots);
}

/**
 * Find which slot (if any) matches the given state.
 * Returns slot index or -1.
 */
export function findMatchingSlot(page, pageState) {
  const slots = readSlots(page);
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (!s) continue;
    if (s.item.id === pageState.itemId) {
      // Compare pageState deeply via JSON
      if (JSON.stringify(s.pageState) === JSON.stringify(pageState)) {
        return i;
      }
    }
  }
  return -1;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/itemSlotStore.mjs
git commit -m "feat: add itemSlotStore shared module for save/bookmark slots"
```

---

### Task 2: Add slot bar + star button CSS to both pages

**Files:**
- Modify: `src/pages/deconstruction.astro` — `<style>` block
- Modify: `src/pages/expected-value.astro` — `<style>` block

- [ ] **Step 1: Add CSS to deconstruction.astro style block**

Insert at the end of the scoped `<style>` block:

```css
/* Item save slots */
.item-slot-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.item-slot {
  position: relative;
  width: 48px;
  height: 48px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: border-color 0.15s;
}

.item-slot--filled {
  border: 2px solid var(--line);
  background: var(--surface-soft);
}

.item-slot--filled:hover {
  border-color: var(--green);
}

.item-slot--empty {
  border: 2px dashed var(--line);
}

.item-slot--empty:hover {
  border-color: var(--muted);
}

.item-slot img {
  width: 32px;
  height: 32px;
  object-fit: contain;
  image-rendering: pixelated;
}

.item-slot-x {
  position: absolute;
  top: -7px;
  right: -7px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  font-size: 0.6rem;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s;
}

.item-slot-x:hover {
  background: #e74c3c;
  border-color: #e74c3c;
  color: #fff;
}

.item-card-star {
  position: absolute;
  top: 6px;
  right: 8px;
  width: 28px;
  height: 28px;
  border: none;
  background: none;
  font-size: 1.2rem;
  cursor: pointer;
  color: var(--muted);
  padding: 0;
  line-height: 1;
  transition: color 0.15s, transform 0.15s;
  z-index: 2;
}

.item-card-star:hover {
  transform: scale(1.15);
}

.item-card-star--saved {
  color: #f0c040;
}

.item-card-star--saved:hover {
  color: #f5d560;
}

/* Slot picker overlay */
.slot-picker-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1001;
}

.slot-picker-dialog {
  background: var(--surface);
  border-radius: 10px;
  padding: 24px;
  max-width: 420px;
  width: 90%;
  box-shadow: 0 4px 24px rgba(0,0,0,0.2);
}

.slot-picker-dialog h3 {
  margin: 0 0 16px;
  font-size: 1rem;
  color: var(--ink);
}

.slot-picker-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}

.slot-picker-slot {
  aspect-ratio: 1;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
  cursor: pointer;
  padding: 8px;
  transition: border-color 0.15s, background 0.15s;
  font-size: 0.65rem;
  color: var(--muted);
  text-align: center;
  position: relative;
}

.slot-picker-slot--filled {
  border: 2px solid var(--line);
  background: var(--surface-soft);
}

.slot-picker-slot--filled:hover {
  border-color: var(--green);
  background: var(--surface);
}

.slot-picker-slot--empty {
  border: 2px dashed var(--line);
}

.slot-picker-slot--empty:hover {
  border-color: var(--green);
}

.slot-picker-slot img {
  width: 36px;
  height: 36px;
  object-fit: contain;
  image-rendering: pixelated;
}

.slot-picker-slot-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.slot-picker-close {
  display: block;
  margin: 16px auto 0;
  padding: 4px 16px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface-soft);
  color: var(--ink);
  cursor: pointer;
  font-size: 0.8rem;
  font-family: inherit;
}

/* Replace confirmation */
.replace-confirm-cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 12px 0;
}

.replace-confirm-card {
  padding: 10px;
  border: 1px solid var(--line);
  border-radius: 6px;
  background: var(--surface-soft);
  text-align: center;
}

.replace-confirm-card h4 {
  margin: 0 0 6px;
  font-size: 0.78rem;
  color: var(--muted);
}

.replace-confirm-card .item-name {
  font-size: 0.82rem;
  font-weight: 700;
  color: var(--ink);
}

.replace-confirm-card img {
  width: 40px;
  height: 40px;
  object-fit: contain;
  image-rendering: pixelated;
  margin-bottom: 4px;
}

.replace-confirm-buttons {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
  margin-top: 12px;
}

.replace-confirm-buttons button {
  padding: 5px 16px;
  border: 1px solid var(--line);
  border-radius: 4px;
  background: var(--surface-soft);
  color: var(--ink);
  cursor: pointer;
  font-size: 0.8rem;
  font-family: inherit;
}

.replace-confirm-buttons button:first-child {
  background: var(--green);
  border-color: var(--green);
  color: #fff;
}
```

- [ ] **Step 2: Copy the identical CSS to expected-value.astro**

Insert at the end of the scoped `<style>` block in `src/pages/expected-value.astro`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/deconstruction.astro src/pages/expected-value.astro
git commit -m "style: add save slot bar, star button, and modal CSS to both calculator pages"
```

---

### Task 3: Integrate save slots into deconstruction.astro

**Files:**
- Modify: `src/pages/deconstruction.astro` — HTML template + `<script>` block

**Context needed:**
- The aside panel template is at lines 314-325
- `selectedItem`, `deconDeltas`, `deconSlotState`, `deconAppliedLevelCount` are the key state variables
- `deconGemFilter`, `deconScrollRateFilter`, `deconStimulantBoundsMap` are the filter states
- Source checkbox DOM refs: `deconScrollSource`, `deconStimulantSource`, `deconGemsSource`, `deconItemLevelUpSource`
- `renderTargetItemCard(selectedItem)` renders the card
- `activateDeconEditPanel(item)` activates the panel
- `itemById` is the item index map
- `statLabelByKey`, `HP_MP_KEYS` are imported

- [ ] **Step 1: Add slot bar HTML to the aside panel**

Read the aside panel HTML (around lines 310-325). Insert the slot bar between the `<h2>아이템 미리보기</h2>` and the placeholder/card divs:

```html
        <h2>아이템 미리보기</h2>
        <div class="item-slot-bar" data-decon-slot-bar hidden></div>
        <p class="enhancement-placeholder" data-item-placeholder>아이템을 선택해주세요</p>
```

Also wrap the item card div in a relative container for the star button:

```html
        <div style="position:relative;" data-selected-item-card-wrapper hidden>
          <button type="button" class="item-card-star" data-decon-star title="슬롯에 저장">☆</button>
          <div class="selected-item-card" data-selected-item-card>
            ... existing content unchanged ...
          </div>
        </div>
```

The original `data-selected-item-card` div becomes wrapped in a `position: relative` container with the star button absolute-positioned on top of it.

- [ ] **Step 2: Add JS: DOM refs, state, and import**

Add DOM refs after existing ones:
```js
const deconSlotBar = document.querySelector('[data-decon-slot-bar]');
const deconStar = document.querySelector('[data-decon-star]');
const selectedItemCardWrapper = document.querySelector('[data-selected-item-card-wrapper]');
```

Add import at the top of the script block:
```js
import { readSlots, writeSlots, saveToSlot, clearSlot, findMatchingSlot } from '../lib/itemSlotStore.mjs';
```

- [ ] **Step 3: Add `buildPageState()` and `checkStarState()` helpers**

```js
const buildPageState = () => {
  if (!selectedItem) return null;
  return {
    itemId: selectedItem.id,
    deconDeltas: { ...deconDeltas },
    successfulScrollCount: deconSlotState.successfulScrollCount,
    remainingSlots: deconSlotState.remainingSlots,
    appliedLevelCount: deconAppliedLevelCount,
    gemFilter: deconGemFilter ? [...deconGemFilter] : null,
    scrollRateFilter: deconScrollRateFilter ? [...deconScrollRateFilter] : null,
    stimulantBoundsMap: deconStimulantBoundsMap ? { ...deconStimulantBoundsMap } : null,
    scrollSource: deconScrollSource?.checked ?? false,
    stimulantSource: deconStimulantSource?.checked ?? false,
    gemsSource: deconGemsSource?.checked ?? false,
    itemLevelUpSource: deconItemLevelUpSource?.checked ?? false,
  };
};

const checkStarState = () => {
  if (!selectedItem || !(deconStar instanceof HTMLElement)) return;
  const state = buildPageState();
  if (!state) { deconStar.textContent = '☆'; deconStar.classList.remove('item-card-star--saved'); return; }
  const match = findMatchingSlot('deconstruction', state);
  if (match >= 0) {
    deconStar.textContent = '★';
    deconStar.classList.add('item-card-star--saved');
  } else {
    deconStar.textContent = '☆';
    deconStar.classList.remove('item-card-star--saved');
  }
};
```

- [ ] **Step 4: Add `renderSlotBar()` helper**

```js
const renderSlotBar = () => {
  if (!(deconSlotBar instanceof HTMLElement)) return;
  const slots = readSlots('deconstruction');
  deconSlotBar.replaceChildren();
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    const box = document.createElement('div');
    box.className = s ? 'item-slot item-slot--filled' : 'item-slot item-slot--empty';
    if (s) {
      const icon = document.createElement('img');
      icon.src = buildItemIconUrl(s.item.iconId);
      icon.alt = s.item.nameKo;
      box.append(icon);
      box.title = s.item.nameKo;
      box.addEventListener('click', () => loadSlot(i));

      const xBtn = document.createElement('button');
      xBtn.type = 'button';
      xBtn.className = 'item-slot-x';
      xBtn.textContent = '×';
      xBtn.addEventListener('click', (e) => { e.stopPropagation(); confirmDeleteSlot(i); });
      box.append(xBtn);
    }
    deconSlotBar.append(box);
  }
};
```

- [ ] **Step 5: Add save picker overlay**

```js
const showSavePicker = () => {
  if (!selectedItem) return;
  const state = buildPageState();
  if (!state) return;

  const slots = readSlots('deconstruction');
  const overlay = document.createElement('div');
  overlay.className = 'slot-picker-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'slot-picker-dialog';

  const title = document.createElement('h3');
  title.textContent = '저장할 슬롯 선택';
  dialog.append(title);

  const grid = document.createElement('div');
  grid.className = 'slot-picker-grid';

  for (let i = 0; i < MAX_SLOTS; i++) {
    const s = slots[i];
    const cell = document.createElement('div');
    cell.className = s ? 'slot-picker-slot slot-picker-slot--filled' : 'slot-picker-slot slot-picker-slot--empty';
    if (s) {
      const icon = document.createElement('img');
      icon.src = buildItemIconUrl(s.item.iconId);
      icon.alt = s.item.nameKo;
      cell.append(icon);
      const name = document.createElement('span');
      name.className = 'slot-picker-slot-name';
      name.textContent = s.item.nameKo;
      cell.append(name);
      cell.addEventListener('click', () => {
        overlay.remove();
        confirmReplace(i, state);
      });
    } else {
      cell.textContent = '빈 슬롯';
      cell.addEventListener('click', () => {
        saveToSlot('deconstruction', i, selectedItem, state);
        overlay.remove();
        renderSlotBar();
        checkStarState();
      });
    }
    grid.append(cell);
  }
  dialog.append(grid);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'slot-picker-close';
  closeBtn.textContent = '취소';
  closeBtn.addEventListener('click', () => overlay.remove());
  dialog.append(closeBtn);

  overlay.append(dialog);
  document.body.append(overlay);
};

// Needs MAX_SLOTS from the module
import { ..., MAX_SLOTS } from ... // update import
```

- [ ] **Step 6: Add replace confirmation + delete confirmation + load functions**

```js
const confirmReplace = (slotIndex, newState) => {
  const slots = readSlots('deconstruction');
  const existing = slots[slotIndex];
  if (!existing) return;

  const overlay = document.createElement('div');
  overlay.className = 'decon-confirm-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'decon-confirm-dialog';
  dialog.style.maxWidth = '500px';

  const msg = document.createElement('p');
  msg.textContent = '기존 저장된 아이템을 덮어쓰시겠습니까?';
  dialog.append(msg);

  const cards = document.createElement('div');
  cards.className = 'replace-confirm-cards';

  // Existing card
  const existingCard = document.createElement('div');
  existingCard.className = 'replace-confirm-card';
  existingCard.innerHTML = `<h4>기존 저장</h4><img src="${buildItemIconUrl(existing.item.iconId)}" alt=""><div class="item-name">${existing.item.nameKo}</div>`;
  cards.append(existingCard);

  // New card
  const newCard = document.createElement('div');
  newCard.className = 'replace-confirm-card';
  newCard.innerHTML = `<h4>새로 저장</h4><img src="${buildItemIconUrl(selectedItem.id)}" alt=""><div class="item-name">${selectedItem.nameKo}</div>`;
  cards.append(newCard);

  dialog.append(cards);

  const buttons = document.createElement('div');
  buttons.className = 'replace-confirm-buttons';
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '덮어쓰기';
  confirmBtn.addEventListener('click', () => {
    saveToSlot('deconstruction', slotIndex, selectedItem, newState);
    overlay.remove();
    renderSlotBar();
    checkStarState();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => overlay.remove());
  buttons.append(confirmBtn, cancelBtn);
  dialog.append(buttons);

  overlay.append(dialog);
  document.body.append(overlay);
};

const confirmDeleteSlot = (slotIndex) => {
  const slots = readSlots('deconstruction');
  const existing = slots[slotIndex];
  if (!existing) return;

  const overlay = document.createElement('div');
  overlay.className = 'decon-confirm-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'decon-confirm-dialog';

  const msg = document.createElement('p');
  msg.textContent = '저장된 아이템을 삭제하시겠습니까?';
  dialog.append(msg);

  // Show saved item card
  const card = document.createElement('div');
  card.className = 'replace-confirm-card';
  card.innerHTML = `<img src="${buildItemIconUrl(existing.item.iconId)}" alt=""><div class="item-name">${existing.item.nameKo}</div>`;
  dialog.append(card);

  const buttons = document.createElement('div');
  buttons.className = 'replace-confirm-buttons';
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '삭제';
  confirmBtn.style.background = '#e74c3c';
  confirmBtn.style.borderColor = '#e74c3c';
  confirmBtn.style.color = '#fff';
  confirmBtn.addEventListener('click', () => {
    clearSlot('deconstruction', slotIndex);
    overlay.remove();
    renderSlotBar();
    checkStarState();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => overlay.remove());
  buttons.append(confirmBtn, cancelBtn);
  dialog.append(buttons);

  overlay.append(dialog);
  document.body.append(overlay);
};

const loadSlot = (slotIndex) => {
  const slots = readSlots('deconstruction');
  const s = slots[slotIndex];
  if (!s) return;

  const item = itemById.get(s.pageState.itemId);
  if (!item) {
    alert('저장된 아이템을 더 이상 찾을 수 없습니다.');
    return;
  }

  // Restore item
  selectedItem = item;
  commitSuggestedItem(item, { syncFilters: false });

  // Restore state
  deconDeltas = { ...s.pageState.deconDeltas };
  deconSlotState = {
    successfulScrollCount: s.pageState.successfulScrollCount,
    remainingSlots: s.pageState.remainingSlots,
    maxSlots: deconSlotState.maxSlots,
  };
  deconAppliedLevelCount = s.pageState.appliedLevelCount ?? 0;
  deconGemFilter = s.pageState.gemFilter ? new Set(s.pageState.gemFilter) : null;
  deconScrollRateFilter = s.pageState.scrollRateFilter ? new Set(s.pageState.scrollRateFilter) : new Set(['100', '60', '10', 'chaos']);
  deconStimulantBoundsMap = s.pageState.stimulantBoundsMap ?? {};

  // Restore source checkboxes
  if (deconScrollSource instanceof HTMLInputElement) deconScrollSource.checked = s.pageState.scrollSource ?? true;
  if (deconStimulantSource instanceof HTMLInputElement) deconStimulantSource.checked = s.pageState.stimulantSource ?? true;
  if (deconGemsSource instanceof HTMLInputElement) deconGemsSource.checked = s.pageState.gemsSource ?? true;
  if (deconItemLevelUpSource instanceof HTMLInputElement) deconItemLevelUpSource.checked = s.pageState.itemLevelUpSource ?? true;

  // Re-render
  deconHasActionableResults = false;
  renderDeconSlotState();
  renderDeconItemLevel();
  rebuildStatEditor();
  updateTargetCard();
  renderSlotBar();
  checkStarState();
  updateAnalyzeButton();
};
```

- [ ] **Step 7: Wire star button click**

```js
deconStar?.addEventListener('click', () => {
  showSavePicker();
});
```

- [ ] **Step 8: Call `renderSlotBar()` and `checkStarState()` at lifecycle points**

- In `activateDeconEditPanel`: after the panel is activated, add `renderSlotBar(); checkStarState();`
- In `setStatDelta`: after `updateTargetCard()`, add `checkStarState();`
- In the slot stepper handlers (success/slot dec/inc): after `renderDeconSlotState()`, add `checkStarState();`
- In the level stepper handlers: after `renderDeconItemLevel()`, add `checkStarState();`
- In `clearDeconCalculationState`: add `checkStarState();`
- After item index loads (where `renderItemSuggestions()` is called): add `renderSlotBar();`

Also unhide `deconSlotBar` and `selectedItemCardWrapper` when the item card is shown:
- In `renderTargetItemCard`: after `selectedItemCard.hidden = false`, add:
  ```js
  if (deconSlotBar instanceof HTMLElement) deconSlotBar.hidden = false;
  if (selectedItemCardWrapper instanceof HTMLElement) selectedItemCardWrapper.hidden = false;
  ```
- In `clearSelectedItemCard`: add:
  ```js
  if (deconSlotBar instanceof HTMLElement) deconSlotBar.hidden = true;
  if (selectedItemCardWrapper instanceof HTMLElement) selectedItemCardWrapper.hidden = true;
  ```

- [ ] **Step 9: Update the import line to include MAX_SLOTS**

Change the import to:
```js
import { readSlots, writeSlots, saveToSlot, clearSlot, findMatchingSlot, MAX_SLOTS } from '../lib/itemSlotStore.mjs';
```

(And export MAX_SLOTS from itemSlotStore.mjs: `export const MAX_SLOTS = 4;`)

- [ ] **Step 10: Build and verify**

```bash
npm run build
```

- [ ] **Step 11: Commit**

```bash
git add src/lib/itemSlotStore.mjs src/pages/deconstruction.astro
git commit -m "feat: integrate save slots into deconstruction page"
```

---

### Task 4: Integrate save slots into expected-value.astro

**Files:**
- Modify: `src/pages/expected-value.astro` — HTML template + `<script>` block

This task follows the same pattern as Task 3 but adapted for the EV page's state model. Key differences:

- State comes from `window.__evState()` which returns `{ enhancementState, selectedBaseItem, scrollsByEquipmentKind, selectedItemLevelUpDefinition }`
- Item card rendering is done by `selected-item-card` elements
- The EV page uses `enhancementPanel.mjs` for the enhancement panel

- [ ] **Step 1: Add slot bar HTML to the aside panel**

Same as Task 3 Step 1 — add `<div class="item-slot-bar" data-ev-slot-bar hidden></div>` after `<h2>아이템 미리보기</h2>` and wrap the item card in a relative container with a star button.

- [ ] **Step 2: Add JS integration**

Add DOM refs, import itemSlotStore, add `buildPageState()` that captures `window.__evState()`, `renderSlotBar()`, `showSavePicker()`, `confirmReplace()`, `confirmDeleteSlot()`, `loadSlot()` — all adapted for the EV page ('expectedValue' page key).

**`buildPageState()` for EV:**
```js
const buildPageState = () => {
  const evState = window.__evState?.();
  if (!evState?.selectedBaseItem) return null;
  return {
    itemId: evState.selectedBaseItem.id,
    enhancementState: JSON.parse(JSON.stringify(evState.enhancementState)),
  };
};
```

**`loadSlot()` for EV:**
```js
const loadSlot = (slotIndex) => {
  const slots = readSlots('expectedValue');
  const s = slots[slotIndex];
  if (!s?.pageState?.enhancementState) return;
  
  const item = itemById.get(s.pageState.itemId);
  if (!item) { alert('저장된 아이템을 더 이상 찾을 수 없습니다.'); return; }
  
  // Set the enhancement state back — this requires the enhancement panel to expose a setter
  // The enhancementPanel.mjs needs a `window.__evSetState(enhancementState, selectedBaseItem)` function
  if (typeof window.__evSetState === 'function') {
    window.__evSetState(s.pageState.enhancementState, item);
  }
  
  renderSlotBar();
  checkStarState();
};
```

**Add to `enhancementPanel.mjs`:**
Expose a setter alongside the existing getter:
```js
window.__evSetState = (newEnhancementState, newSelectedBaseItem) => {
  enhancementState = newEnhancementState;
  selectedBaseItem = newSelectedBaseItem;
  // Re-render all panels
  renderScrollList();
  renderGemSlots();
  // ... etc
};
```

Actually, the EV page's enhancement state restoration is complex because the enhancement panel maintains internal state. A simpler approach: store the enhancement state JSON, and on load, call into the enhancement panel's existing initialization to rebuild from scratch with the stored item, then apply the stored enhancement state.

This requires adding to `enhancementPanel.mjs` an export like:
```js
export function restoreEnhancementState(storedEnhancementState, item) { ... }
```

But this is a large change. For the plan, we note that the EV integration requires exposing a restore function from enhancementPanel.mjs.

- [ ] **Step 3: Wire lifecycle points and commit**

```bash
git add src/pages/expected-value.astro src/lib/enhancementPanel.mjs
git commit -m "feat: integrate save slots into expected-value page"
```

---

### Task 5: Verify

- [ ] **Step 1: Build**

```bash
npm run build
```

- [ ] **Step 2: Dev server verification**

On deconstruction page:
1. Select an item → slot bar appears, star shows ☆
2. Click ☆ → save picker shows 4 slots
3. Click empty slot → saves, star turns ★
4. Edit a stat → star reverts to ☆
5. Click ★ → resave
6. Click a filled slot in the bar → loads saved state
7. Click × on a slot → delete confirmation shows item card
8. Confirm delete → slot clears

On expected-value page:
1. Configure an item with enhancements
2. Save to a slot
3. Load from slot → enhancement state restores

- [ ] **Step 3: Commit fixes**

```bash
git add -A && git commit -m "fix: adjustments from verification"
```
