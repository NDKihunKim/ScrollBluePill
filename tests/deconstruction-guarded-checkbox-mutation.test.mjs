import test from 'node:test';
import assert from 'node:assert/strict';

import { guardCheckboxMutation } from '../src/lib/deconstruction/guardedCheckboxMutation.mjs';

test('cancelled checkbox mutation restores the original state without applying', () => {
  const input = { checked: true };
  let confirm;
  let applyCalls = 0;

  guardCheckboxMutation(
    input,
    (onConfirm) => { confirm = onConfirm; },
    () => { applyCalls += 1; },
  );

  assert.equal(input.checked, false);
  assert.equal(applyCalls, 0);
  assert.equal(typeof confirm, 'function');
});

test('confirmed checkbox mutation applies the browser-toggled state', () => {
  const input = { checked: true };
  let confirm;
  let applyCalls = 0;

  guardCheckboxMutation(
    input,
    (onConfirm) => { confirm = onConfirm; },
    () => { applyCalls += 1; },
  );

  confirm();

  assert.equal(input.checked, true);
  assert.equal(applyCalls, 1);
});
