import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getDefaultSourceSelection,
  getSourceValidationMessage,
  resolveAllowedSources,
} from '../src/lib/deconstruction/sourcePolicy.mjs';

const NO_SOURCE_MESSAGE = '분석에 사용할 강화 유형을 하나 이상 선택해주세요';
const SCROLL_CONFLICT_MESSAGE = '주문서 성공 횟수가 1회 이상으로 설정되어 있어 주문서를 제외할 수 없습니다. 성공한 주문서가 있는 아이템은 주문서를 사용하지 않은 전략으로 분석할 수 없습니다.';

test('source selection defaults to all false', () => {
  assert.deepEqual(getDefaultSourceSelection(), {
    scrolls: false,
    stimulant: false,
    gems: false,
    itemLevelUp: false,
  });
});

test('ineligible item level-up is masked without changing other selections', () => {
  const selection = { scrolls: true, stimulant: true, gems: true, itemLevelUp: true };

  assert.deepEqual(resolveAllowedSources(selection, { itemLevelUpEligible: false }), {
    scrolls: true,
    stimulant: true,
    gems: true,
    itemLevelUp: false,
  });
  assert.equal(selection.itemLevelUp, true);
});

test('source validation rejects an empty selection with the exact message', () => {
  assert.equal(
    getSourceValidationMessage({ scrolls: false, stimulant: false, gems: false, itemLevelUp: false }, 0),
    NO_SOURCE_MESSAGE,
  );
});

test('source validation rejects disabling scrolls after a successful scroll', () => {
  assert.equal(
    getSourceValidationMessage({ scrolls: false, stimulant: true, gems: false, itemLevelUp: false }, 1),
    SCROLL_CONFLICT_MESSAGE,
  );
});

test('a non-scroll source is valid when successful scroll count is zero', () => {
  assert.equal(
    getSourceValidationMessage({ scrolls: false, stimulant: true, gems: false, itemLevelUp: false }, 0),
    '',
  );
});

test('eligibility refresh preserves selections unless reset is requested', () => {
  const selection = { scrolls: false, stimulant: true, gems: true, itemLevelUp: true };

  assert.deepEqual(
    resolveAllowedSources(selection, { itemLevelUpEligible: true, reset: false }),
    selection,
  );
  assert.deepEqual(
    resolveAllowedSources(selection, { itemLevelUpEligible: true, reset: true }),
    getDefaultSourceSelection(),
  );
});
