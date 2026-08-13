// ---- Confirmation + slot save dialogs for deconstruction page ----

/**
 * Create a native <dialog> element as the base for all dialogs.
 * @param {string} className - CSS class for the dialog
 * @param {string} ariaLabel - Accessible label
 * @returns {{ dialog: HTMLDialogElement, returnEl: Element | null }}
 */
function createDialog(className, ariaLabel) {
  const returnEl = document.activeElement;
  const dialog = document.createElement('dialog');
  dialog.className = className;
  dialog.setAttribute('aria-label', ariaLabel);
  return { dialog, returnEl };
}

/**
 * Dismiss a dialog: close, remove from DOM, and restore focus.
 */
function dismissDialog(dialog, returnEl) {
  dialog.close();
  dialog.remove();
  if (returnEl instanceof HTMLElement) returnEl.focus();
}

/**
 * Generic confirmation dialog using native <dialog>.
 */
export function showDeconConfirmDialog({
  message,
  confirmLabel = '확인',
  cancelLabel = '취소',
  onConfirm,
  onCancel,
  destructive = false,
} = {}) {
  const { dialog, returnEl } = createDialog('decon-confirm-dialog', message);

  const msg = document.createElement('p');
  msg.textContent = message;

  const buttonRow = document.createElement('div');
  buttonRow.className = 'decon-confirm-buttons';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = confirmLabel;
  if (destructive) {
    confirmBtn.style.background = '#e74c3c';
    confirmBtn.style.borderColor = '#e74c3c';
    confirmBtn.style.color = '#fff';
  }
  confirmBtn.addEventListener('click', () => {
    dismissDialog(dialog, returnEl);
    if (onConfirm) onConfirm();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = cancelLabel;
  cancelBtn.addEventListener('click', () => {
    dismissDialog(dialog, returnEl);
    if (onCancel) onCancel();
  });

  buttonRow.append(confirmBtn, cancelBtn);
  dialog.append(msg, buttonRow);
  document.body.append(dialog);
  dialog.showModal();
}

/** Shortcut for the "reset all" confirmation. */
export function showResetConfirmDialog(onConfirm, onCancel) {
  showDeconConfirmDialog({
    message: '모든 계산 설정과 분석 결과를 초기화합니다. 계속하시겠습니까?',
    confirmLabel: '초기화',
    cancelLabel: '취소',
    destructive: true,
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
    destructive: true,
    onConfirm,
  });
}

/**
 * Slot save picker dialog — lets the user pick which slot to save into.
 * Calls onSlotChanged() after any save, replace, or delete.
 */
export function showDeconSavePicker({
  selectedItem,
  buildPageState,
  readSlots,
  saveToSlot,
  MAX_SLOTS,
  buildItemIconUrl,
  onSlotChanged,
}) {
  if (!selectedItem) return;
  const state = buildPageState();
  if (!state) return;

  const slots = readSlots('deconstruction');
  const { dialog, returnEl } = createDialog('slot-picker-dialog', '저장할 슬롯 선택');

  const title = document.createElement('h3');
  title.textContent = '저장할 슬롯 선택';
  dialog.append(title);

  const grid = document.createElement('div');
  grid.className = 'slot-picker-grid';

  for (let i = 0; i < MAX_SLOTS; i++) {
    const s = slots[i];
    const cell = document.createElement('div');
    cell.setAttribute('role', 'button');
    cell.setAttribute('tabindex', '0');
    cell.className = s
      ? 'slot-picker-slot slot-picker-slot--filled'
      : 'slot-picker-slot slot-picker-slot--empty';
    if (s) {
      cell.setAttribute('aria-label', `${s.item.nameKo} - 덮어쓰기`);
      const icon = document.createElement('img');
      icon.src = buildItemIconUrl(s.item.iconId);
      icon.alt = s.item.nameKo;
      cell.append(icon);
      const name = document.createElement('span');
      name.className = 'slot-picker-slot-name';
      name.textContent = s.item.nameKo;
      cell.append(name);
      cell.addEventListener('click', () => {
        dismissDialog(dialog, returnEl);
        confirmReplaceDeconSlot({
          slotIndex: i,
          newState: state,
          selectedItem,
          readSlots,
          saveToSlot,
          buildItemIconUrl,
          onSlotChanged,
        });
      });
    } else {
      cell.setAttribute('aria-label', '빈 슬롯에 저장');
      cell.textContent = '빈 슬롯';
      cell.addEventListener('click', () => {
        saveToSlot('deconstruction', i, selectedItem, state);
        dismissDialog(dialog, returnEl);
        if (onSlotChanged) onSlotChanged();
      });
    }
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        cell.click();
      }
    });
    grid.append(cell);
  }
  dialog.append(grid);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'slot-picker-close';
  closeBtn.textContent = '취소';
  closeBtn.addEventListener('click', () => dismissDialog(dialog, returnEl));
  dialog.append(closeBtn);

  document.body.append(dialog);
  dialog.showModal();
}

/** Confirm-and-replace for an occupied slot. */
export function confirmReplaceDeconSlot({
  slotIndex,
  newState,
  selectedItem,
  readSlots,
  saveToSlot,
  buildItemIconUrl,
  onSlotChanged,
}) {
  const slots = readSlots('deconstruction');
  const existing = slots[slotIndex];
  if (!existing) return;

  const { dialog, returnEl } = createDialog(
    'decon-confirm-dialog',
    '기존 저장된 아이템을 덮어쓰시겠습니까?',
  );
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
    dismissDialog(dialog, returnEl);
    if (onSlotChanged) onSlotChanged();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => dismissDialog(dialog, returnEl));
  buttons.append(confirmBtn, cancelBtn);
  dialog.append(buttons);

  document.body.append(dialog);
  dialog.showModal();
}

/** Confirm-and-delete for an occupied slot. */
export function confirmDeleteDeconSlot({
  slotIndex,
  readSlots,
  clearSlot,
  buildItemIconUrl,
  onSlotChanged,
}) {
  const slots = readSlots('deconstruction');
  const s = slots[slotIndex];
  if (!s) return;

  const { dialog, returnEl } = createDialog(
    'decon-confirm-dialog',
    '저장된 아이템을 삭제하시겠습니까?',
  );

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
    dismissDialog(dialog, returnEl);
    if (onSlotChanged) onSlotChanged();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => dismissDialog(dialog, returnEl));
  buttons.append(confirmBtn, cancelBtn);
  dialog.append(buttons);

  document.body.append(dialog);
  dialog.showModal();
}

/** Confirm unsave when the current state matches a saved slot. */
export function confirmUnsaveDeconSlot({
  buildPageState,
  findMatchingSlot,
  readSlots,
  clearSlot,
  buildItemIconUrl,
  onSlotChanged,
}) {
  const state = buildPageState();
  if (!state) return;
  const slotIndex = findMatchingSlot('deconstruction', state);
  if (slotIndex < 0) return;
  const slots = readSlots('deconstruction');
  const s = slots[slotIndex];
  if (!s) return;

  const { dialog, returnEl } = createDialog(
    'decon-confirm-dialog',
    '이 설정은 슬롯에 저장되어 있습니다. 저장을 해제하시겠습니까?',
  );

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
    dismissDialog(dialog, returnEl);
    if (onSlotChanged) onSlotChanged();
  });
  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => dismissDialog(dialog, returnEl));
  buttons.append(confirmBtn, cancelBtn);
  dialog.append(buttons);

  document.body.append(dialog);
  dialog.showModal();
}

/**
 * Screenshot upload dialog: paste, drag-and-drop, or click to pick a file.
 * Closes itself before calling onScreenshot(blob).
 * @param {{ screenshotInput: HTMLInputElement, onScreenshot?: (blob: Blob) => void }} opts
 */
export function showScreenshotUploadDialog({ screenshotInput, onScreenshot } = {}) {
  const { dialog, returnEl } = createDialog('screenshot-upload-dialog', '스크린샷 업로드');

  const close = (blob) => {
    screenshotInput.removeEventListener('change', onInputChange); // idempotent
    dismissDialog(dialog, returnEl);
    if (blob) onScreenshot?.(blob);
  };

  const title = document.createElement('h3');
  title.textContent = '스크린샷 업로드';

  const notice = document.createElement('p');
  notice.className = 'screenshot-upload-notice';
  notice.textContent = '배경이 투명하지 않은 스크린샷만 완벽하게 분석됩니다';

  const dropzone = document.createElement('div');
  dropzone.className = 'screenshot-upload-dropzone';
  dropzone.setAttribute('role', 'button');
  dropzone.setAttribute('tabindex', '0');
  dropzone.setAttribute('aria-label', '스크린샷 붙여넣기 또는 파일 선택');
  const zoneText = document.createElement('div');
  zoneText.textContent = '여기에 스크린샷을 붙여넣거나 드래그하세요 (Ctrl+V)';
  const zoneHint = document.createElement('small');
  zoneHint.textContent = '또는 클릭하여 파일 선택';
  dropzone.append(zoneText, zoneHint);
  dropzone.addEventListener('click', () => {
    screenshotInput.value = '';
    screenshotInput.click();
  });
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      dropzone.click();
    }
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.textContent = '취소';
  cancelBtn.addEventListener('click', () => close(null));
  const buttonRow = document.createElement('div');
  buttonRow.className = 'decon-confirm-buttons';
  buttonRow.append(cancelBtn);

  dialog.append(title, notice, dropzone, buttonRow);

  // Paste (dialog holds focus after showModal; events bubble to it)
  dialog.addEventListener('paste', (event) => {
    const item = [...(event.clipboardData?.items ?? [])].find((i) =>
      i.type.startsWith('image/'),
    );
    if (!item) return; // non-image paste: ignore
    event.preventDefault();
    const blob = item.getAsFile();
    if (blob) close(blob);
  });

  // Drag & drop (backdrop region retargets to the dialog element)
  dialog.addEventListener('dragover', (event) => {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy';
    dropzone.classList.add('screenshot-upload-dropzone--over');
  });
  dialog.addEventListener('dragleave', () =>
    dropzone.classList.remove('screenshot-upload-dropzone--over'),
  );
  dialog.addEventListener('drop', (event) => {
    event.preventDefault();
    dropzone.classList.remove('screenshot-upload-dropzone--over');
    const file = event.dataTransfer?.files?.[0]; // first file wins
    if (file && file.type.startsWith('image/')) close(file);
  });

  // File picker change — wired here so the dialog closes itself first.
  // Removed in close() so canceled dialogs don't accumulate listeners.
  const onInputChange = () => {
    const file = screenshotInput.files?.[0];
    screenshotInput.value = '';
    if (file) close(file);
  };
  screenshotInput.addEventListener('change', onInputChange);

  // Esc: preventDefault stops the native close, then dismissDialog
  // removes the node cleanly (existing dialogs skip this and leak).
  dialog.addEventListener('cancel', (event) => {
    event.preventDefault();
    close(null);
  });

  document.body.append(dialog);
  dialog.showModal();
}
