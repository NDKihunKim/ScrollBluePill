/**
 * Development-only debug logging helper.
 *
 * `import.meta.env.DEV` is an Astro/Vite compile-time constant. In `astro dev`
 * it's `true` and logs fire normally. In `astro build` it's replaced with
 * `false` and the minifier removes the console.log inside this function.
 *
 * IMPORTANT — eager argument evaluation:
 *   JavaScript evaluates function arguments BEFORE the call. Even though
 *   `debug()` becomes an empty function in production, its arguments are
 *   still computed. For lightweight args (a string, an existing variable),
 *   this is fine. For expensive computations (JSON.stringify, structuredClone,
 *   array.map/filter), wrap the call in a DEV guard so the entire block is
 *   eliminated:
 *
 *     // ✅ Fine for lightweight args:
 *     debug('items loaded', count);
 *
 *     // ✅ Expensive payloads — wrap in DEV guard:
 *     if (import.meta.env.DEV) {
 *       debug(JSON.stringify(largeObject));
 *       debug('state dump', structuredClone(someState));
 *     }
 *
 * Usage:
 *   import { debug } from '../lib/debug.mjs';
 *   debug('computation inputs', someValue);
 */
export function debug(...args) {
  if (import.meta.env.DEV) {
    console.log(...args);
  }
}
