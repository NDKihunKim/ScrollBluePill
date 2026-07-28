// ---- Confirmation + slot save dialogs for deconstruction page ----

/**
 * Generic confirmation overlay. Creates its own DOM, appends to body.
 * Removes itself on confirm or cancel.
 */
export function showDeconConfirmDialog({ message, confirmLabel = '확인', cancelLabel = '취소', onConfirm, onCancel } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'decon-confirm-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'decon-confirm-dialog';

  const msg = document.createElement('p');
  msg.textContent = message;

  const buttonRow = document.createElement('div');
  buttonRow.className = 'decon-confirm-buttons';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = confirmLabel;
  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    if (onConfirm) onConfirm();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = cancelLabel;
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
    if (onCancel) onCancel();
  });

  buttonRow.append(confirmBtn, cancelBtn);
  dialog.append(msg, buttonRow);
  overlay.append(dialog);
  document.body.append(overlay);
}

/** Shortcut for the "reset all" confirmation. */
export function showResetConfirmDialog(onConfirm, onCancel) {
  showDeconConfirmDialog({
    message: '모든 계산 설정과 분석 결과를 초기화합니다. 계속하시겠습니까?',
    confirmLabel: '초기화',
    cancelLabel: '취소',
    onConfirm,
    onCancel,
  });
}

/** Shortcut for the "item change" confirmation. */
export function showDeconItemChangeDialog(onConfirm) {
  showDeconConfirmDialog({
    message: '아이템을 변경하면 현재 스탯 편집과 분석 결과가 초기화됩니다. 계속하시겠습니까?',
    confirmLabel: '변경',
    cancelLabel: '취소',
    onConfirm,
  });
}

/**
 * Slot save picker overlay — lets the user pick which slot to save into.
 * Calls onSlotChanged() after any save, replace, or delete.
 */
export function showDeconSavePicker({ selectedItem, buildPageState, readSlots, saveToSlot, MAX_SLOTS, buildItemIconUrl, onSlotChanged }) {
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
        confirmReplaceDeconSlot({ slotIndex: i, newState: state, selectedItem, readSlots, saveToSlot, buildItemIconUrl, onSlotChanged });
      });
    } else {
      cell.textContent = '빈 슬롯';
      cell.addEventListener('click', () => {
        saveToSlot('deconstruction', i, selectedItem, state);
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

/** Confirm-and-replace for an occupied slot. */
export function confirmReplaceDeconSlot({ slotIndex, newState, selectedItem, readSlots, saveToSlot, buildItemIconUrl, onSlotChanged }) {
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
    saveToSlot('deconstruction', slotIndex, selectedItem, newState);
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

/** Confirm-and-delete for an occupied slot. */
export function confirmDeleteDeconSlot({ slotIndex, readSlots, clearSlot, buildItemIconUrl, onSlotChanged }) {
  const slots = readSlots('deconstruction');
  const s = slots[slotIndex];
  if (!s) return;

  const overlay = document.createElement('div');
  overlay.className = 'decon-confirm-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'decon-confirm-dialog';

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
    clearSlot('deconstruction', slotIndex);
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

/** Confirm unsave when the current state matches a saved slot. */
export function confirmUnsaveDeconSlot({ buildPageState, findMatchingSlot, readSlots, clearSlot, buildItemIconUrl, onSlotChanged }) {
  const state = buildPageState();
  if (!state) return;
  const slotIndex = findMatchingSlot('deconstruction', state);
  if (slotIndex < 0) return;
  const slots = readSlots('deconstruction');
  const s = slots[slotIndex];
  if (!s) return;

  const overlay = document.createElement('div');
  overlay.className = 'decon-confirm-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'decon-confirm-dialog';

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
    clearSlot('deconstruction', slotIndex);
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
