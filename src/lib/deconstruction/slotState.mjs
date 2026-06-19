function normalizeCount(value) {
  const count = Number(value);
  return Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
}

function normalizeState(state) {
  const maxSlots = normalizeCount(state?.maxSlots);
  const successfulScrollCount = Math.min(
    normalizeCount(state?.successfulScrollCount),
    maxSlots,
  );
  const remainingSlots = Math.min(
    normalizeCount(state?.remainingSlots),
    maxSlots - successfulScrollCount,
  );

  return { maxSlots, successfulScrollCount, remainingSlots };
}

export function createDeconstructionSlotState(maxSlots) {
  const normalizedMaxSlots = normalizeCount(maxSlots);

  return {
    maxSlots: normalizedMaxSlots,
    successfulScrollCount: 0,
    remainingSlots: normalizedMaxSlots,
  };
}

export function setSuccessfulScrollCount(state, value) {
  const current = normalizeState(state);
  const successfulScrollCount = Math.min(normalizeCount(value), current.maxSlots);

  return {
    ...current,
    successfulScrollCount,
    remainingSlots: Math.min(
      current.remainingSlots,
      current.maxSlots - successfulScrollCount,
    ),
  };
}

export function setRemainingSlotCount(state, value) {
  const current = normalizeState(state);

  return {
    ...current,
    remainingSlots: Math.min(
      normalizeCount(value),
      current.maxSlots - current.successfulScrollCount,
    ),
  };
}

export function inferFailedScrollCount(state) {
  const current = normalizeState(state);
  return current.maxSlots - current.successfulScrollCount - current.remainingSlots;
}
