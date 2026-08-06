/**
 * Client-side screenshot-to-stats parser using Tesseract.js OCR.
 * Lazy-loads the Tesseract worker on first call (~4MB CDN payload).
 */
import { searchKoreanItems } from './itemSearch.mjs';

// ── Tesseract lazy-init ────────────────────────────────────────

let _workerPromise = null;
const getWorker = () => (_workerPromise ??= import('tesseract.js').then(
  ({ createWorker }) => createWorker('kor+eng', 1, { logger: () => {} })
));

// ── OCR ─────────────────────────────────────────────────────────

/**
 * Run OCR on an image blob. Returns { text: string, confidence: number }.
 * Confidence is the average word-level confidence (0–100).
 */
export async function ocrImage(blob) {
  const worker = await getWorker();
  const { data } = await worker.recognize(blob, {}, {});
  const words = data.words ?? [];
  const avgConfidence =
    words.length > 0
      ? words.reduce((sum, w) => sum + w.confidence, 0) / words.length
      : 0;
  return { text: data.text, confidence: avgConfidence };
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
  const cleaned = firstLine.replace(
    /\s*(STR|DEX|INT|LUK|공격력|마력|최대\s*HP|최대\s*MP|물리방어력|마법방어력|명중률|회피율|이동속도|점프력)\s*:?\s*\+?\d+.*$/i,
    ''
  ).trim();
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

  const patterns = [
    { regex: /STR\s*:?\s*\+?(\d+)/i,                     key: 'str' },
    { regex: /DEX\s*:?\s*\+?(\d+)/i,                     key: 'dex' },
    { regex: /INT\s*:?\s*\+?(\d+)/i,                     key: 'int' },
    { regex: /LUK\s*:?\s*\+?(\d+)/i,                     key: 'luk' },
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

// ── Combined pipeline ───────────────────────────────────────────

/**
 * Full pipeline: OCR → extract item name → parse stats.
 * Returns { itemName: string, stats: Record<string, number>, confidence: number }.
 */
export async function parseScreenshot(blob) {
  const { text, confidence } = await ocrImage(blob);
  const itemName = extractItemName(text);
  const stats = parseStats(text);
  return { itemName, stats, confidence };
}

/**
 * Match a parsed item name against the item index.
 * Returns the best-matching item or null.
 */
export function matchItem(itemName, itemIndex) {
  if (!itemName) return null;
  const results = searchKoreanItems(itemName, { items: itemIndex, limit: 1 });
  return results.length > 0 ? results[0] : null;
}
