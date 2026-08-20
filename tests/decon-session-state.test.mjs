import assert from 'node:assert/strict';
import test from 'node:test';

// Node has no HTMLInputElement; the stub is needed because collectDeconState
// references it at call time (see tests/persistence.test.mjs for the same convention).
globalThis.HTMLInputElement = class HTMLInputElement {};

import { collectDeconState } from '../src/lib/deconSessionState.mjs';

const buildOpts = (overrides = {}) => ({
  selectedItem: { id: 1001, nameKo: '테스트 무기' },
  itemNameInput: null, // not an input → falls back to item name
  deconDeltas: { str: 25 },
  deconStatKeys: ['str'],
  deconStatMode: 'add',
  slotState: { successfulScrollCount: 3, remainingSlots: 5, maxSlots: 8 },
  totalAppliedScrolls: 4,
  appliedLevelCount: 1,
  scrollRateFilter: new Set(['100', '60']),
  stimulantBoundsMap: { str: { min: -10, max: 10 } },
  stimulantEnabledKeys: ['str'],
  chaosBoundsMap: {},
  chaosEnabledKeys: [],
  gemFilter: new Set([1, 2]),
  levelUpTotalRanges: { str: { min: 1, max: 3 } },
  getCheckedTargetKeys: () => ['str', 'dex'],
  sourceInputs: { scrolls: null, stimulant: null, gems: null, itemLevelUp: null },
  ...overrides,
});

test('collectDeconState builds the snapshot shape share links use', () => {
  const snapshot = collectDeconState(buildOpts());

  assert.equal(snapshot.itemId, 1001);
  assert.equal(snapshot.itemName, '테스트 무기');
  assert.deepEqual(snapshot.deconDeltas, { str: 25 });
  assert.deepEqual(snapshot.deconStatKeys, ['str']);
  assert.equal(snapshot.deconStatMode, 'add');
  assert.equal(snapshot.successfulScrollCount, 3);
  assert.equal(snapshot.remainingSlots, 5);
  assert.equal(snapshot.maxSlots, 8);
  assert.equal(snapshot.totalAppliedScrolls, 4);
  assert.equal(snapshot.appliedLevelCount, 1);
  assert.deepEqual(snapshot.scrollRateFilter, ['100', '60']);
  assert.deepEqual(snapshot.stimulantBoundsMap, { str: { min: -10, max: 10 } });
  assert.deepEqual(snapshot.stimulantEnabledKeys, ['str']);
  assert.deepEqual(snapshot.chaosBoundsMap, {});
  assert.deepEqual(snapshot.chaosEnabledKeys, []);
  assert.deepEqual(snapshot.gemFilter, [1, 2]);
  assert.deepEqual(snapshot.levelUpTotalRanges, { str: { min: 1, max: 3 } });
  assert.deepEqual(snapshot.targetKeys, ['str', 'dex']);
  assert.deepEqual(snapshot.sourceChecked, {
    scrolls: false,
    stimulant: false,
    gems: false,
    itemLevelUp: false,
  });
  // Share payloads must not carry scrollPosition (meaningless to the recipient)
  assert.ok(!('scrollPosition' in snapshot));
});

test('collectDeconState clones mutable inputs', () => {
  const deconDeltas = { str: 1 };
  const scrollRateFilter = new Set(['100']);
  const gemFilter = new Set([7]);
  const stimulantBoundsMap = { str: { min: -10, max: 10 } };
  const snapshot = collectDeconState(
    buildOpts({ deconDeltas, scrollRateFilter, gemFilter, stimulantBoundsMap }),
  );

  deconDeltas.str = 99;
  scrollRateFilter.add('60');
  gemFilter.add(8);
  stimulantBoundsMap.str = { min: 99, max: 99 };

  assert.equal(snapshot.deconDeltas.str, 1);
  assert.deepEqual(snapshot.scrollRateFilter, ['100']);
  assert.deepEqual(snapshot.gemFilter, [7]);
  assert.deepEqual(snapshot.stimulantBoundsMap, { str: { min: -10, max: 10 } });
});

test('collectDeconState reads live input values and null gemFilter', () => {
  const fakeInput = (props) => Object.assign(new HTMLInputElement(), props);
  const snapshot = collectDeconState(
    buildOpts({
      itemNameInput: fakeInput({ value: '커스텀 이름' }),
      gemFilter: null,
      sourceInputs: {
        scrolls: fakeInput({ checked: true }),
        stimulant: null,
        gems: fakeInput({ checked: false }),
        itemLevelUp: null,
      },
    }),
  );

  assert.equal(snapshot.itemName, '커스텀 이름');
  assert.equal(snapshot.gemFilter, null);
  assert.deepEqual(snapshot.sourceChecked, {
    scrolls: true,
    stimulant: false,
    gems: false,
    itemLevelUp: false,
  });
});
