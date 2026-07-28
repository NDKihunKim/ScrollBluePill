// ---- Slot bar UI helpers for expected-value page ----

export function buildEvPageState() {
  const evState = globalThis.__evState?.();
  if (!evState?.selectedBaseItem) return null;
  return {
    itemId: evState.selectedBaseItem.id,
    enhancementState: evState.enhancementState,
  };
}

export function checkEvStarState({ evStar, buildPageState, findMatchingSlot }) {
  if (!(evStar instanceof globalThis.HTMLElement)) return;
  const state = buildPageState();
  if (!state) {
    evStar.textContent = '☆';
    evStar.classList.remove('item-card-star--saved');
    return;
  }
  const match = findMatchingSlot('expectedValue', state);
  if (match >= 0) {
    evStar.textContent = '★';
    evStar.classList.add('item-card-star--saved');
  } else {
    evStar.textContent = '☆';
    evStar.classList.remove('item-card-star--saved');
  }
}

export function renderEvSlotBar({ evSlotBar, readSlots, MAX_SLOTS, buildItemIconUrl, onLoadSlot, onDeleteSlot }) {
  if (!(evSlotBar instanceof globalThis.HTMLElement)) return;
  const slots = readSlots('expectedValue');
  evSlotBar.replaceChildren();
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
    evSlotBar.append(box);
  }
}

export function showEvSavePicker({ buildPageState, readSlots, saveToSlot, MAX_SLOTS, buildItemIconUrl, onSlotChanged }) {
  const evState = globalThis.__evState?.();
  const selectedItem = evState?.selectedBaseItem;
  if (!selectedItem) return;
  const state = buildPageState();
  if (!state) return;

  const slots = readSlots('expectedValue');
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
        confirmReplaceEvSlot({ slotIndex: i, newState: state, buildPageState, readSlots, saveToSlot, buildItemIconUrl, onSlotChanged });
      });
    } else {
      cell.textContent = '빈 슬롯';
      cell.addEventListener('click', () => {
        saveToSlot('expectedValue', i, selectedItem, state);
        overlay.remove();
        if (onSlotChanged) onSlotChanged();
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
}

export function confirmReplaceEvSlot({ slotIndex, newState, buildPageState, readSlots, saveToSlot, buildItemIconUrl, onSlotChanged }) {
  const evState = globalThis.__evState?.();
  const selectedItem = evState?.selectedBaseItem;
  if (!selectedItem) return;
  const slots = readSlots('expectedValue');
  const existing = slots[slotIndex];
  if (!existing) return;

  const overlay = document.createElement('div');
  overlay.className = 'ev-confirm-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'ev-confirm-dialog';
  dialog.style.maxWidth = '500px';

  const msg = document.createElement('p');
  msg.textContent = '기존 저장된 아이템을 덮어쓰시겠습니까?';
  dialog.append(msg);

  const cards = document.createElement('div');
  cards.className = 'replace-confirm-cards';

  const existingCard = document.createElement('div');
  existingCard.className = 'replace-confirm-card';
  const existingH4 = document.createElement('h4');
  existingH4.textContent = '기존 저장';
  existingCard.append(existingH4);
  const existingImg = document.createElement('img');
  existingImg.src = buildItemIconUrl(existing.item.iconId);
  existingImg.alt = existing.item.nameKo;
  existingCard.append(existingImg);
  const existingName = document.createElement('div');
  existingName.className = 'item-name';
  existingName.textContent = existing.item.nameKo;
  existingCard.append(existingName);
  cards.append(existingCard);

  const newCard = document.createElement('div');
  newCard.className = 'replace-confirm-card';
  const newH4 = document.createElement('h4');
  newH4.textContent = '새로 저장';
  newCard.append(newH4);
  const newImg = document.createElement('img');
  newImg.src = buildItemIconUrl(selectedItem.id);
  newImg.alt = selectedItem.nameKo;
  newCard.append(newImg);
  const newName = document.createElement('div');
  newName.className = 'item-name';
  newName.textContent = selectedItem.nameKo;
  newCard.append(newName);
  cards.append(newCard);
  dialog.append(cards);

  const buttons = document.createElement('div');
  buttons.className = 'replace-confirm-buttons';
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '덮어쓰기';
  confirmBtn.addEventListener('click', () => {
    saveToSlot('expectedValue', slotIndex, selectedItem, newState);
    overlay.remove();
    if (onSlotChanged) onSlotChanged();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => overlay.remove());
  buttons.append(confirmBtn, cancelBtn);
  dialog.append(buttons);
  overlay.append(dialog);
  document.body.append(overlay);
}

export function confirmDeleteEvSlot({ slotIndex, readSlots, clearSlot, buildItemIconUrl, onSlotChanged }) {
  const slots = readSlots('expectedValue');
  const s = slots[slotIndex];
  if (!s) return;

  const overlay = document.createElement('div');
  overlay.className = 'ev-confirm-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'ev-confirm-dialog';

  const msg = document.createElement('p');
  msg.textContent = '저장된 아이템을 삭제하시겠습니까?';
  dialog.append(msg);

  const card = document.createElement('div');
  card.className = 'replace-confirm-card';
  const cardImg = document.createElement('img');
  cardImg.src = buildItemIconUrl(s.item.iconId);
  cardImg.alt = s.item.nameKo;
  card.append(cardImg);
  const cardName = document.createElement('div');
  cardName.className = 'item-name';
  cardName.textContent = s.item.nameKo;
  card.append(cardName);
  dialog.append(card);

  const buttons = document.createElement('div');
  buttons.className = 'replace-confirm-buttons';
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '삭제';
  confirmBtn.style.background = '#e74c3c';
  confirmBtn.style.borderColor = '#e74c3c';
  confirmBtn.style.color = '#fff';
  confirmBtn.addEventListener('click', () => {
    clearSlot('expectedValue', slotIndex);
    overlay.remove();
    if (onSlotChanged) onSlotChanged();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => overlay.remove());
  buttons.append(confirmBtn, cancelBtn);
  dialog.append(buttons);
  overlay.append(dialog);
  document.body.append(overlay);
}

export function confirmUnsaveEvSlot({ buildPageState, findMatchingSlot, readSlots, clearSlot, buildItemIconUrl, onSlotChanged }) {
  const state = buildPageState();
  if (!state) return;
  const slotIndex = findMatchingSlot('expectedValue', state);
  if (slotIndex < 0) return;
  const slots = readSlots('expectedValue');
  const s = slots[slotIndex];
  if (!s) return;

  const overlay = document.createElement('div');
  overlay.className = 'ev-confirm-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'ev-confirm-dialog';

  const msg = document.createElement('p');
  msg.textContent = '이 설정은 슬롯에 저장되어 있습니다. 저장을 해제하시겠습니까?';
  dialog.append(msg);

  const card = document.createElement('div');
  card.className = 'replace-confirm-card';
  const cardImg = document.createElement('img');
  cardImg.src = buildItemIconUrl(s.item.iconId);
  cardImg.alt = s.item.nameKo;
  card.append(cardImg);
  const cardName = document.createElement('div');
  cardName.className = 'item-name';
  cardName.textContent = s.item.nameKo;
  card.append(cardName);
  dialog.append(card);

  const buttons = document.createElement('div');
  buttons.className = 'replace-confirm-buttons';
  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = '해제';
  confirmBtn.style.background = '#e74c3c';
  confirmBtn.style.borderColor = '#e74c3c';
  confirmBtn.style.color = '#fff';
  confirmBtn.addEventListener('click', () => {
    clearSlot('expectedValue', slotIndex);
    overlay.remove();
    if (onSlotChanged) onSlotChanged();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => overlay.remove());
  buttons.append(confirmBtn, cancelBtn);
  dialog.append(buttons);
  overlay.append(dialog);
  document.body.append(overlay);
}
