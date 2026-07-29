// ---- Confirmation dialogs for expected-value page ----

import { CONFIRM_TEXT, CONFIRM_BUTTON_TEXT, CANCEL_BUTTON_TEXT } from './expectedValuePanel.mjs';

export function showEvConfirmationDialog(
  onConfirm,
  {
    message = CONFIRM_TEXT,
    confirmLabel = CONFIRM_BUTTON_TEXT,
    cancelLabel = CANCEL_BUTTON_TEXT,
  } = {},
) {
  const returnEl = document.activeElement;

  const dialog = document.createElement('dialog');
  dialog.className = 'ev-confirm-dialog';
  dialog.setAttribute('role', 'alertdialog');
  dialog.setAttribute('aria-label', message);

  const msg = document.createElement('p');
  msg.textContent = message;

  const buttonRow = document.createElement('div');
  buttonRow.className = 'ev-confirm-buttons';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = confirmLabel;
  confirmBtn.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
    if (returnEl instanceof HTMLElement) returnEl.focus();
    onConfirm();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = cancelLabel;
  cancelBtn.addEventListener('click', () => {
    dialog.close();
    dialog.remove();
    if (returnEl instanceof HTMLElement) returnEl.focus();
  });

  buttonRow.append(confirmBtn, cancelBtn);
  dialog.append(msg, buttonRow);
  document.body.append(dialog);
  dialog.showModal();
}
