import assert from 'node:assert/strict';
import test from 'node:test';

const RNG_MODULE = '../src/lib/expectedValue/monteCarloEngine.mjs';

test('createSeededRng produces deterministic sequence', async () => {
  const { createSeededRng } = await import(RNG_MODULE);

  const rng1 = createSeededRng(42);
  const rng2 = createSeededRng(42);

  const seq1 = Array.from({ length: 10 }, () => rng1());
  const seq2 = Array.from({ length: 10 }, () => rng2());

  assert.deepEqual(seq1, seq2);
});

test('createSeededRng produces values in [0, 1)', async () => {
  const { createSeededRng } = await import(RNG_MODULE);

  const rng = createSeededRng(12345);

  for (let i = 0; i < 1000; i++) {
    const value = rng();
    assert.ok(value >= 0, `value ${value} should be >= 0`);
    assert.ok(value < 1, `value ${value} should be < 1`);
  }
});

test('createSeededRng different seeds produce different sequences', async () => {
  const { createSeededRng } = await import(RNG_MODULE);

  const rng1 = createSeededRng(1);
  const rng2 = createSeededRng(2);

  const seq1 = Array.from({ length: 5 }, () => rng1());
  const seq2 = Array.from({ length: 5 }, () => rng2());

  assert.notDeepEqual(seq1, seq2);
});

test('createRandomSeed returns a 32-bit integer', async () => {
  const { createRandomSeed } = await import(RNG_MODULE);

  const seed = createRandomSeed();

  assert.ok(Number.isInteger(seed));
  assert.ok(seed >= 0, `seed ${seed} should be >= 0`);
  assert.ok(seed <= 0xFFFFFFFF, `seed ${seed} should be <= 0xFFFFFFFF`);
});
