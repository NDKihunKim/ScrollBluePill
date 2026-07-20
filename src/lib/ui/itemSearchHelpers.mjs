// ---- Shared item search helpers used by deconstruction + EV pages ----

import { jobKindByRequiredJob } from './itemCardHelpers.mjs';

export function getSelectedJobKinds(jobInputs) {
  return new Set(
    [...(jobInputs ?? [])]
      .filter((input) => input instanceof HTMLInputElement && input.checked)
      .map((input) => input.value),
  );
}

export function itemMatchesSelectedJobs(item, selectedJobs) {
  if (selectedJobs.size === 0) return false;
  const requiredJobs = item.requiredJobs ?? [];
  const hasOnlyBeginner = requiredJobs.length === 1 && requiredJobs[0] === 'Beginner';
  if (requiredJobs.length === 0 || hasOnlyBeginner) return true;
  return requiredJobs.some((job) => selectedJobs.has(jobKindByRequiredJob[job]));
}
