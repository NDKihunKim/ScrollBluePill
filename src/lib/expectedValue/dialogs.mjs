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
  const overlay = document.createElement('div');
  overlay.className = 'ev-confirm-overlay';

  const dialog = document.createElement('div');
  dialog.className = 'ev-confirm-dialog';

  const msg = document.createElement('p');
  msg.textContent = message;

  const buttonRow = document.createElement('div');
  buttonRow.className = 'ev-confirm-buttons';

  const confirmBtn = document.createElement('button');
  confirmBtn.textContent = confirmLabel;
  confirmBtn.addEventListener('click', () => {
    overlay.remove();
    onConfirm();
  });

  const cancelBtn = document.createElement('button');
  cancelBtn.textContent = cancelLabel;
  cancelBtn.addEventListener('click', () => {
    overlay.remove();
  });

  buttonRow.append(confirmBtn, cancelBtn);
  dialog.append(msg, buttonRow);
  overlay.append(dialog);
  document.body.append(overlay);
}
