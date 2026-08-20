import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeShareLink, decodeShareLink } from '../src/lib/deconstruction/shareLink.mjs';

// Raw (uncompressed) payload builder — mimics the old-browser fallback format.
const toBase64Url = (json) =>
  btoa(unescape(encodeURIComponent(json))).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');

const SNAPSHOT = {
  itemId: 1001,
  itemName: '테스트 무기',
  deconDeltas: { str: 25 },
  deconStatKeys: ['str'],
  deconStatMode: 'add',
  successfulScrollCount: 3,
  remainingSlots: 5,
  maxSlots: 8,
  totalAppliedScrolls: 4,
  appliedLevelCount: 1,
  scrollRateFilter: ['100', '60'],
  stimulantBoundsMap: { str: { min: -10, max: 10 } },
  stimulantEnabledKeys: ['str'],
  chaosBoundsMap: {},
  chaosEnabledKeys: [],
  gemFilter: [1, 2],
  levelUpTotalRanges: { str: { min: 1, max: 3 } },
  targetKeys: ['str', 'dex'],
  sourceChecked: { scrolls: true, stimulant: false, gems: false, itemLevelUp: false },
};

test('encode → decode round-trips state and strategyIndex', async () => {
  const payload = await encodeShareLink(SNAPSHOT, 3);
  assert.equal(typeof payload, 'string');
  assert.ok(payload.length > 0);

  const decoded = await decodeShareLink(payload);
  assert.equal(decoded.v, 1);
  assert.equal(decoded.strategyIndex, 3);
  for (const [key, value] of Object.entries(SNAPSHOT)) {
    assert.deepEqual(decoded[key], value, `key ${key} must round-trip`);
  }
});

test('gzipped payload stays well under a 2 KB URL budget', async () => {
  const payload = await encodeShareLink(SNAPSHOT, 0);
  assert.ok(payload.length < 2000, `payload was ${payload.length} chars`);
});

test('encode falls back to raw JSON without CompressionStream', async () => {
  const original = globalThis.CompressionStream;
  globalThis.CompressionStream = undefined;
  try {
    const payload = await encodeShareLink(SNAPSHOT, 1);
    const decoded = await decodeShareLink(payload);
    assert.equal(decoded.strategyIndex, 1);
    assert.equal(decoded.itemId, 1001);
  } finally {
    globalThis.CompressionStream = original;
  }
});

test('decode accepts uncompressed payloads (old-browser fallback)', async () => {
  const payload = toBase64Url(JSON.stringify({ v: 1, ...SNAPSHOT, strategyIndex: 2 }));
  const decoded = await decodeShareLink(payload);
  assert.equal(decoded.strategyIndex, 2);
  assert.equal(decoded.itemId, 1001);
});

test('decode rejects garbage', async () => {
  assert.equal(await decodeShareLink('!!!not-base64!!!'), null);
});

test('decode rejects unknown version', async () => {
  const payload = toBase64Url(JSON.stringify({ v: 2, itemId: 1, strategyIndex: 0 }));
  assert.equal(await decodeShareLink(payload), null);
});

test('decode rejects payloads without itemId', async () => {
  const payload = toBase64Url(JSON.stringify({ v: 1, strategyIndex: 0 }));
  assert.equal(await decodeShareLink(payload), null);
});
