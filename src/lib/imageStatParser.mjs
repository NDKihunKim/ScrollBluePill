/**
 * Client-side screenshot-to-stats parser using Tesseract.js OCR.
 * Lazy-loads the Tesseract worker on first call (self-hosted assets in /ocr/).
 */
import { searchKoreanItems } from './itemSearch.mjs';

// ── Tesseract lazy-init ────────────────────────────────────────

// ponytail: 30s timeout — tesseract.js swallows init errors internally
// (.catch(() => {}) in createWorker), so a failed importScripts or fetch
// inside the worker causes the promise to hang forever instead of rejecting.
// The timeout guarantees we surface an error rather than spinning indefinitely.
const WORKER_TIMEOUT_MS = 30_000;

let _workerPromise = null;
const getWorker = () => {
  if (_workerPromise) return _workerPromise;

  console.warn('[OCR] Step 1/5: importing tesseract.js module…');
  _workerPromise = import('tesseract.js').then(
    ({ createWorker }) => {
      console.warn('[OCR] Step 2/5: tesseract.js loaded, creating worker…');

      const options = {
        logger: (m) => {
          if (m.status) console.warn(`[OCR] worker progress: ${m.status} (${Math.round(m.progress * 100)}%)`);
        },
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/tesseract-core-lstm.wasm.js',
        langPath: '/ocr',
        workerBlobURL: false,
        gzip: false,
      };
      console.warn('[OCR] Step 3/5: createWorker options:', JSON.stringify(options));

      const workerPromise = createWorker('kor+eng', 1, options);

      const withTimeout = Promise.race([
        workerPromise.then(w => {
          console.warn('[OCR] Step 5/5: worker ready');
          return w;
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Tesseract worker init timed out after 30s')), WORKER_TIMEOUT_MS)
        ),
      ]);

      console.warn('[OCR] Step 4/5: waiting for worker init (30s timeout)…');
      return withTimeout;
    }
  ).catch(err => {
    console.warn('[OCR] FAILED:', err.message || err);
    _workerPromise = null;
    throw err;
  });
  return _workerPromise;
};

// ── OCR ─────────────────────────────────────────────────────────

/**
 * Run OCR on an image blob. Returns { text: string, confidence: number }.
 * Confidence is the average word-level confidence (0–100).
 */
export async function ocrImage(blob) {
  const worker = await getWorker();
  try {
    const { data } = await worker.recognize(blob, {}, {});
    const words = data.words ?? [];
    const avgConfidence =
      words.length > 0
        ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
        : 0;
    return { text: data.text, confidence: avgConfidence };
  } catch (err) {
    // Worker may have crashed internally — discard so next attempt
    // creates a fresh one instead of reusing a poisoned instance.
    _workerPromise = null;
    try { await worker.terminate(); } catch { /* best effort */ }
    throw err;
  }
}

// ── Item name extraction ───────────────────────────────────────

/**
 * Extract a potential item name from the first line of OCR text.
 * Strips trailing stat patterns that commonly bleed into the name line.
 */
export function extractItemName(rawText) {
  const lines = rawText.split('\n').filter(Boolean);
  if (lines.length === 0) return '';
  const firstLine = lines[0].trim();
  // Strip stat suffixes, enhancement level notation (+N), and trailing garbage
  const cleaned = firstLine
    .replace(/\(\+\d+\)/g, '') // enhancement level e.g. "드래곤 퍼플 슬리브 (+6)"
    .replace(
      /\s*(STR|DEX|INT|LUK|공격력|마력|최대\s*HP|최대\s*MP|물리방어력|마법방어력|명중률|회피율|이동속도|점프력)\s*:?\s*\+?\d+.*$/i,
      ''
    )
    .trim();
  return cleaned;
}

// ── Stat parsing ────────────────────────────────────────────────

/**
 * Parse stat key/value pairs from OCR text lines.
 * Each line is matched against known Korean stat label patterns.
 * Returns: { str?: number, dex?: number, ... }
 */
export function parseStats(rawText) {
  const stats = {};
  const lines = rawText.split('\n');

  // ponytail: English labels anchored at word start to avoid matching
  // REQDEX/REQSTR/REQINT/REQLUK requirement lines as stat bonuses.
  const patterns = [
    { regex: /(?:^|\s)STR\s*:?\s*\+?(\d+)/i,            key: 'str' },
    { regex: /(?:^|\s)DEX\s*:?\s*\+?(\d+)/i,            key: 'dex' },
    { regex: /(?:^|\s)INT\s*:?\s*\+?(\d+)/i,            key: 'int' },
    { regex: /(?:^|\s)LUK\s*:?\s*\+?(\d+)/i,            key: 'luk' },
    { regex: /공격력\s*:?\s*\+?(\d+)/,                    key: 'weaponAttack' },
    { regex: /마력\s*:?\s*\+?(\d+)/,                      key: 'magicAttack' },
    { regex: /최대\s*HP\s*:?\s*\+?(\d+)/i,               key: 'maxHp' },
    { regex: /최대\s*MP\s*:?\s*\+?(\d+)/i,               key: 'maxMp' },
    { regex: /물리방어력\s*:?\s*\+?(\d+)/,                 key: 'weaponDefense' },
    { regex: /마법방어력\s*:?\s*\+?(\d+)/,                 key: 'magicDefense' },
    { regex: /명중률\s*:?\s*\+?(\d+)/,                    key: 'accuracy' },
    { regex: /회피율\s*:?\s*\+?(\d+)/,                    key: 'avoidability' },
    { regex: /이동속도\s*:?\s*\+?(\d+)/,                   key: 'speed' },
    { regex: /점프력\s*:?\s*\+?(\d+)/,                     key: 'jump' },
  ];

  for (const line of lines) {
    for (const { regex, key } of patterns) {
      const match = line.match(regex);
      if (match) {
        const value = parseInt(match[1], 10);
        if (Number.isFinite(value)) {
          stats[key] = value;
        }
        break;
      }
    }
  }

  return stats;
}

// ── Slot info extraction ────────────────────────────────────────

/**
 * Extract enhancement level from (+N) on the name line,
 * and remaining upgrade slots from 업그레이드 가능 횟수.
 * Returns { enhancementLevel: number, remainingSlots: number }.
 */
export function parseSlotInfo(rawText) {
  const firstLine = rawText.split('\n')[0] ?? '';
  const enhanceMatch = firstLine.match(/\(\+(\d+)\)/);
  const enhancementLevel = enhanceMatch ? parseInt(enhanceMatch[1], 10) : 0;

  const slotsMatch = rawText.match(/업그레이드\s*가능\s*횟수\s*:\s*(\d+)/);
  const remainingSlots = slotsMatch ? parseInt(slotsMatch[1], 10) : 0;

  return { enhancementLevel, remainingSlots };
}

// ── Combined pipeline ───────────────────────────────────────────

/**
 * Full pipeline: OCR → extract item name → parse stats → parse slot info.
 * Returns { itemName, stats, confidence, enhancementLevel, remainingSlots }.
 */
export async function parseScreenshot(blob) {
  const { text, confidence } = await ocrImage(blob);
  const itemName = extractItemName(text);
  const stats = parseStats(text);
  const { enhancementLevel, remainingSlots } = parseSlotInfo(text);
  return { itemName, stats, confidence, enhancementLevel, remainingSlots };
}

/**
 * Match a parsed item name against the item index.
 * Returns the best-matching item or null.
 */
export function matchItem(itemName, itemIndex) {
  if (!itemName) return null;

  const results = searchKoreanItems(itemName, { items: itemIndex, limit: 1 });
  if (results.length > 0) return results[0];

  // ponytail: fallback — strip trailing chars one at a time to tolerate
  // single-character OCR errors (e.g. 슬리브→슬레브). Stops at 3 chars.
  let query = itemName.replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
  while (query.length >= 3) {
    query = query.slice(0, -1);
    const retry = searchKoreanItems(query, { items: itemIndex, limit: 1 });
    if (retry.length > 0) return retry[0];
  }

  return null;
}
