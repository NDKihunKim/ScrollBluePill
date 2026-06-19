import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addVectors,
  isExactVector,
  projectVector,
  subtractVectors,
  vectorKey,
} from '../src/lib/deconstruction/statVectors.mjs';

const keys = ['str', 'weaponAttack'];

test('projection ignores unchecked stats and preserves negative values', () => {
  assert.deepEqual(projectVector({ str: -2, dex: 9, weaponAttack: 3 }, keys), {
    str: -2,
    weaponAttack: 3,
  });
});

test('vector arithmetic uses missing values as zero', () => {
  assert.deepEqual(addVectors({ str: 2 }, { str: -3, weaponAttack: 1 }, keys), {
    str: -1,
    weaponAttack: 1,
  });
  assert.deepEqual(subtractVectors({ str: 2 }, { str: 5 }, keys), {
    str: -3,
    weaponAttack: 0,
  });
});

test('exact matching and keys are stable in checked-key order', () => {
  assert.equal(isExactVector({ str: -2, weaponAttack: 3 }, { weaponAttack: 3, str: -2 }, keys), true);
  assert.equal(vectorKey({ weaponAttack: 3, str: -2 }, keys), 'str:-2|weaponAttack:3');
});
