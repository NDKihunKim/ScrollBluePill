/**
 * Privacy-first analytics beacon for Cloudflare Pages.
 *
 * Uses navigator.sendBeacon() — fire-and-forget, never blocks the page,
 * never delays navigation.  If the browser doesn't support sendBeacon
 * or if JSON serialization fails, the call silently no-ops.  Analytics
 * must never break the application.
 *
 * The /cdn-cgi/rum endpoint is Cloudflare's built-in Real User
 * Monitoring collector, available on all Pages-served sites without
 * additional configuration.
 */

const BEACON_ENDPOINT = '/cdn-cgi/rum';

/**
 * Send a named analytics event with optional properties.
 *
 * @param {string} name - event name (e.g. 'deconstruction_analysis')
 * @param {Record<string, unknown>} [props] - optional event metadata
 */
export function trackEvent(name, props = {}) {
  try {
    const payload = JSON.stringify({ name, props, ts: Date.now() });
    navigator.sendBeacon(BEACON_ENDPOINT, payload);
  } catch {
    // silently fail — analytics must never break the app
  }
}

/**
 * Report an uncaught frontend error to the RUM endpoint.
 *
 * @param {string} message - error message
 * @param {string} source - script URL
 * @param {number} lineno - line number
 * @param {number} colno - column number
 * @param {Error|undefined} error - the error object (for stack trace)
 */
export function trackError(message, source, lineno, colno, error) {
  try {
    const payload = JSON.stringify({
      type: 'error',
      message,
      source,
      lineno,
      colno,
      stack: error?.stack?.slice(0, 500) ?? '',
      ts: Date.now(),
    });
    navigator.sendBeacon(BEACON_ENDPOINT, payload);
  } catch {
    // silently fail
  }
}
