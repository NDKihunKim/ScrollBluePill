/**
 * Self-contained share-link codec for deconstruction results.
 *
 * Link format (?s= param):
 *   base64url(gzip(JSON({ v:1, ...state, strategyIndex })))
 *
 * When CompressionStream is unavailable (old Safari), encode falls back to
 * uncompressed raw JSON base64url — functionally identical, just longer.
 * decode transparently accepts both: it tries gzip first, then raw JSON.
 */

const VERSION = 1;

function bytesToBase64Url(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

function base64UrlToBytes(payload) {
  const b64 = payload
    .replaceAll('-', '+')
    .replaceAll('_', '/')
    .padEnd(Math.ceil(payload.length / 4) * 4, '=');
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/**
 * Encode a deconstruction state snapshot + strategy index into a `?s=` payload.
 *
 * @param {object} state - collectDeconState() snapshot
 * @param {number} strategyIndex - index of the strategy to highlight
 * @returns {Promise<string>} base64url payload (no padding)
 */
export async function encodeShareLink(state, strategyIndex) {
  const json = JSON.stringify({ v: VERSION, ...state, strategyIndex });
  if (typeof CompressionStream === 'function') {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'));
    const compressed = await new Response(stream).arrayBuffer();
    return bytesToBase64Url(new Uint8Array(compressed));
  }
  return bytesToBase64Url(new TextEncoder().encode(json));
}

/**
 * Decode a `?s=` payload back into a state snapshot.
 *
 * @param {string|null} payload - the ?s= query value
 * @returns {Promise<object|null>} decoded state (+ strategyIndex), or null if
 *   absent, corrupt, wrong version, or missing itemId
 */
export async function decodeShareLink(payload) {
  if (!payload) return null;
  // Cap input size before decompressing attacker-controlled payloads.
  // gzip can amplify ~1000x (measured); legit links are <2 KB, so 16 KB
  // bounds worst-case expansion to ~16 MB and rejects nothing real.
  if (payload.length > 16000) return null;
  try {
    const bytes = base64UrlToBytes(payload);
    let json;
    if (typeof DecompressionStream === 'function') {
      try {
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
        json = await new Response(stream).text();
      } catch {
        // Not gzip — fall back to raw JSON (uncompressed link)
        json = new TextDecoder().decode(bytes);
      }
    } else {
      json = new TextDecoder().decode(bytes);
    }
    const data = JSON.parse(json);
    if (!data || data.v !== VERSION || !data.itemId) return null;
    return data;
  } catch {
    return null;
  }
}
