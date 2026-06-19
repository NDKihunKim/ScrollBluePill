import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createDeconstructionSlotState,
  inferFailedScrollCount,
  setRemainingSlotCount,
  setSuccessfulScrollCount,
} from '../src/lib/deconstruction/slotState.mjs';

test('creates a slot state with every slot remaining', () => {
  assert.deepEqual(createDeconstructionSlotState(7), {
    maxSlots: 7,
    successfulScrollCount: 0,
    remainingSlots: 7,
  });
});

test('setting successful scrolls consumes remaining slots', () => {
  const state = createDeconstructionSlotState(7);

  assert.deepEqual(setSuccessfulScrollCount(state, 3), {
    maxSlots: 7,
    successfulScrollCount: 3,
    remainingSlots: 4,
  });
  assert.deepEqual(state, {
    maxSlots: 7,
    successfulScrollCount: 0,
    remainingSlots: 7,
  });
});

test('decreasing successful scrolls preserves remaining slots and exposes failures', () => {
  const state = { maxSlots: 7, successfulScrollCount: 4, remainingSlots: 2 };
  const nextState = setSuccessfulScrollCount(state, 2);

  assert.deepEqual(nextState, {
    maxSlots: 7,
    successfulScrollCount: 2,
    remainingSlots: 2,
  });
  assert.equal(inferFailedScrollCount(nextState), 3);
  assert.deepEqual(state, { maxSlots: 7, successfulScrollCount: 4, remainingSlots: 2 });
});

test('remaining slots clamp to capacity without changing successes', () => {
  const state = { maxSlots: 7, successfulScrollCount: 3, remainingSlots: 1 };

  assert.deepEqual(setRemainingSlotCount(state, 99), {
    maxSlots: 7,
    successfulScrollCount: 3,
    remainingSlots: 4,
  });
  assert.deepEqual(state, { maxSlots: 7, successfulScrollCount: 3, remainingSlots: 1 });
});

test('max and input counts normalize to non-negative integers', () => {
  assert.deepEqual(createDeconstructionSlotState(-7), {
    maxSlots: 0,
    successfulScrollCount: 0,
    remainingSlots: 0,
  });
  assert.deepEqual(createDeconstructionSlotState(7.9), {
    maxSlots: 7,
    successfulScrollCount: 0,
    remainingSlots: 7,
  });

  const state = createDeconstructionSlotState(7);
  assert.equal(setSuccessfulScrollCount(state, -2).successfulScrollCount, 0);
  assert.equal(setSuccessfulScrollCount(state, 99).successfulScrollCount, 7);
  assert.equal(setSuccessfulScrollCount(state, 3.9).successfulScrollCount, 3);

  const withSuccesses = setSuccessfulScrollCount(state, 3);
  assert.equal(setRemainingSlotCount(withSuccesses, -2).remainingSlots, 0);
  assert.equal(setRemainingSlotCount(withSuccesses, 99).remainingSlots, 4);
  assert.equal(setRemainingSlotCount(withSuccesses, 2.9).remainingSlots, 2);
});
