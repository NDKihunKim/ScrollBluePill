// Persistence module tests — itemSlotStore, deconSessionState, deconToEvTransfer
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';

// ── Mock storage before imports ──────────────────────────────────

let _local = new Map();
let _session = new Map();

globalThis.localStorage = {
  getItem: (k) => _local.get(k) ?? null,
  setItem: (k, v) => { _local.set(k, v); },
  removeItem: (k) => { _local.delete(k); },
};

globalThis.sessionStorage = {
  getItem: (k) => _session.get(k) ?? null,
  setItem: (k, v) => { _session.set(k, v); },
  removeItem: (k) => { _session.delete(k); },
};

// Static imports — storage mocks are in place before these evaluate
import {
  readSlots,
  saveToSlot,
  clearSlot,
  findMatchingSlot,
} from '../src/lib/itemSlotStore.mjs';

import {
  saveDeconSession,
  loadDeconSession,
  clearDeconSession,
} from '../src/lib/deconSessionState.mjs';

import {
  writeDeconTransfer,
  consumeDeconTransfer,
  DECON_TO_EV_KEY,
} from '../src/lib/deconToEvTransfer.mjs';

// ── itemSlotStore ─────────────────────────────────────────────────

describe('itemSlotStore', () => {

  test('readSlots returns MAX_SLOTS nulls for empty storage', () => {
    _local.clear();
    const slots = readSlots('deconstruction');
    assert.equal(slots.length, 5);
    assert.deepEqual(slots, [null, null, null, null, null]);
  });

  test('saveToSlot and readSlots round-trip', () => {
    const item = { id: 1, nameKo: '테스트', equipmentKind: '장갑', requiredLevel: 30 };
    assert.equal(saveToSlot('deconstruction', 0, item, { itemId: 1, deconDeltas: { str: 5 } }), true);
    const slots = readSlots('deconstruction');
    assert.ok(slots[0]);
    assert.equal(slots[0].item.id, 1);
    assert.equal(slots[0].item.nameKo, '테스트');
    assert.equal(slots[0].pageState.deconDeltas.str, 5);
  });

  test('clearSlot removes the entry', () => {
    const item = { id: 1, nameKo: '테스트', equipmentKind: '장갑', requiredLevel: 30 };
    saveToSlot('deconstruction', 2, item, { itemId: 1 });
    clearSlot('deconstruction', 2);
    assert.equal(readSlots('deconstruction')[2], null);
  });

  test('saveToSlot rejects out-of-bounds indices', () => {
    const item = { id: 1, nameKo: 'X', equipmentKind: '장갑', requiredLevel: 30 };
    assert.equal(saveToSlot('deconstruction', -1, item, {}), false);
    assert.equal(saveToSlot('deconstruction', 5, item, {}), false);
  });

  test('findMatchingSlot locates saved state', () => {
    const item = { id: 42, nameKo: '테스트', equipmentKind: '장갑', requiredLevel: 30 };
    const state = {
      itemId: 42,
      deconDeltas: { str: 3, dex: 2 },
      deconStatKeys: ['str', 'dex'],
      successfulScrollCount: 1,
      remainingSlots: 6,
    };
    saveToSlot('deconstruction', 1, item, state);
    assert.equal(findMatchingSlot('deconstruction', state), 1);
  });

  test('findMatchingSlot returns -1 for no match', () => {
    assert.equal(findMatchingSlot('deconstruction', { itemId: 99, deconDeltas: {} }), -1);
  });

  test('readSlots handles malformed JSON gracefully', () => {
    _local.set('itemSlots:v1:deconstruction', '{bad json');
    assert.deepEqual(readSlots('deconstruction'), [null, null, null, null, null]);
  });

  test('readSlots normalizes shorter arrays', () => {
    _local.set('itemSlots:v1:deconstruction', JSON.stringify([{ item: { id: 1 }, savedAt: '', pageState: {} }]));
    const slots = readSlots('deconstruction');
    assert.equal(slots.length, 5);
    assert.ok(slots[0]);
    assert.equal(slots[1], null);
  });

  test('slots are independent per page', () => {
    const item = { id: 1, nameKo: 'A', equipmentKind: '장갑', requiredLevel: 0 };
    saveToSlot('deconstruction', 0, item, { itemId: 1 });
    saveToSlot('expectedValue', 0, item, { itemId: 1 });
    // Different pages don't collide
    assert.ok(readSlots('deconstruction')[0]);
    assert.ok(readSlots('expectedValue')[0]);
  });
});

// ── deconSessionState ─────────────────────────────────────────────

describe('deconSessionState', () => {
  test('loadDeconSession returns null when empty', () => {
    _session.clear();
    assert.equal(loadDeconSession(), null);
  });

  test('save and load round-trip', () => {
    _session.clear();
    saveDeconSession({ itemId: 5, deconDeltas: { str: 3 } });
    const loaded = loadDeconSession();
    assert.equal(loaded.v, 1);
    assert.equal(loaded.itemId, 5);
    assert.equal(loaded.deconDeltas.str, 3);
  });

  test('clearDeconSession removes saved data', () => {
    _session.clear();
    saveDeconSession({ itemId: 1 });
    clearDeconSession();
    assert.equal(loadDeconSession(), null);
  });

  test('rejects wrong version payload', () => {
    sessionStorage.setItem('deconSession:v1', JSON.stringify({ v: 2, itemId: 1 }));
    assert.equal(loadDeconSession(), null);
    assert.equal(sessionStorage.getItem('deconSession:v1'), null);
  });

  test('handles malformed JSON', () => {
    sessionStorage.setItem('deconSession:v1', 'not json');
    assert.equal(loadDeconSession(), null);
    assert.equal(sessionStorage.getItem('deconSession:v1'), null);
  });
});

// ── deconToEvTransfer ─────────────────────────────────────────────

describe('deconToEvTransfer', () => {

  const makeStrategy = (overrides = {}) => ({
    scrolls: [{ id: 1, nameKo: '주문서', stats: { str: 1 } }],
    sourceTypes: ['scrolls'],
    ...overrides,
  });

  test('write and consume round-trip', () => {
    writeDeconTransfer(makeStrategy(), 10);
    const raw = _local.get(DECON_TO_EV_KEY);
    assert.ok(raw);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.v, 1);
    assert.equal(parsed.itemId, 10);
    assert.ok(typeof parsed.transferId === 'string');
    assert.equal(parsed.strategy.scrolls.length, 1);

    const consumed = consumeDeconTransfer();
    assert.ok(consumed);
    assert.equal(consumed.v, 1);
    assert.equal(consumed.itemId, 10);
  });

  test('consume returns null with no payload', () => {
    _local.clear();
    _session.clear();
    assert.equal(consumeDeconTransfer(), null);
  });

  test('consume returns null for stale payload', () => {
    writeDeconTransfer(makeStrategy(), 5);
    const raw = _local.get(DECON_TO_EV_KEY);
    const parsed = JSON.parse(raw);
    parsed.transferredAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    _local.set(DECON_TO_EV_KEY, JSON.stringify(parsed));
    assert.equal(consumeDeconTransfer(), null);
  });

  test('dedup: second consume of same transferId returns null', () => {
    writeDeconTransfer(makeStrategy(), 3);
    const first = consumeDeconTransfer();
    assert.ok(first);
    const second = consumeDeconTransfer();
    assert.equal(second, null);
  });

  test('handles malformed payload', () => {
    _local.set(DECON_TO_EV_KEY, '{bad');
    assert.equal(consumeDeconTransfer(), null);
  });
});
