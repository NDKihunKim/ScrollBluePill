/**
 * Creates a deterministic pseudorandom number generator using Mulberry32.
 *
 * @param {number} seed - A 32-bit integer seed
 * @returns {() => number} A function that returns uniform [0, 1) values
 */
export function createSeededRng(seed) {
  let state = seed | 0;
  return function next() {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a random 32-bit seed.
 * Uses crypto.getRandomValues in browser environments,
 * falls back to Math.random elsewhere.
 *
 * @returns {number} A 32-bit unsigned integer
 */
export function createRandomSeed() {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const arr = new Uint32Array(1);
    crypto.getRandomValues(arr);
    return arr[0];
  }
  return (Math.random() * 4294967296) | 0;
}
