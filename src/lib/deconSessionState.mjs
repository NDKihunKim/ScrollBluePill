/**
 * Session-scoped auto-persistence for the deconstruction page.
 *
 * Saves the full page state to sessionStorage before navigation away so that
 * browser Back/Forward and refresh can restore the prior user-visible state
 * without re-running the calculation manually.
 *
 * Uses sessionStorage (not localStorage) so state auto-expires when the tab
 * closes — a new tab visit always gets a clean slate.
 */

/** sessionStorage key for the auto-save payload. */
const SESSION_KEY = 'deconSession:v1';

/**
 * Save the full deconstruction page state to sessionStorage.
 *
 * @param {object} state - Serialisable page state object
 */
export function saveDeconSession(state) {
  try {
    const payload = {
      v: 1,
      timestamp: new Date().toISOString(),
      ...state,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch {
    // sessionStorage unavailable or full — silently continue
  }
}

/**
 * Read the saved deconstruction session state from sessionStorage.
 * Does NOT consume (delete) the entry — it persists for subsequent
 * Back navigations and refreshes.
 *
 * @returns {object|null} The parsed state object, or null if absent or invalid
 */
export function loadDeconSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;

    const payload = JSON.parse(raw);
    if (!payload || payload.v !== 1) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return payload;
  } catch {
    try {
      sessionStorage.removeItem(SESSION_KEY);
    } catch {
      // best effort
    }
    return null;
  }
}

/**
 * Remove the saved deconstruction session state from sessionStorage.
 * Call when the user starts a fresh calculation so stale state does not
 * reappear on the next page load.
 */
export function clearDeconSession() {
  try {
    sessionStorage.removeItem(SESSION_KEY);
  } catch {
    // best effort
  }
}
