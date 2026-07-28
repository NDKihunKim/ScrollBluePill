/**
 * Stimulant (촉진제) probability model for the EV calculation pipeline.
 *
 * When the user enables "확률 계산에 포함" (include in probability calculation),
 * each stat delta is treated as a desired outcome drawn from a known
 * distribution. The overall stimulant probability is:
 *
 *   P(stimulant) = STIMULANT_SUCCESS_RATE × Π P(delta_i)
 *
 * Only positive deltas exist for stimulants (no negative branches).
 * The ×2 entries represent two independent branches/occurrences for that
 * delta, combined into a single probability weight.
 */

/** 90% success rate for stimulant application. */
export const STIMULANT_SUCCESS_RATE = 0.9;

/**
 * Outcome distribution for a single stat delta under stimulant.
 *
 * Each entry maps a target delta to its combined probability (sum of all
 * independent branches that produce that delta).
 *
 * Source distribution (from game logic):
 *   delta  0: 20.0%  (1 branch)
 *   delta +1: 17.6% × 2 branches
 *   delta +2: 12.1% × 2 branches
 *   delta +3:  6.4% × 2 branches
 *   delta +4:  2.7% × 2 branches
 *   delta +5:  1.1% × 2 branches
 *
 * Combined probabilities sum to ~100% (within rounding).
 */
export const STIMULANT_OUTCOME_TABLE = [
  { delta: 0, probability: 0.2 },
  { delta: 1, probability: 0.352 }, // 17.6% × 2 branches
  { delta: 2, probability: 0.242 }, // 12.1% × 2 branches
  { delta: 3, probability: 0.128 }, //  6.4% × 2 branches
  { delta: 4, probability: 0.054 }, //  2.7% × 2 branches
  { delta: 5, probability: 0.022 }, //  1.1% × 2 branches
];
