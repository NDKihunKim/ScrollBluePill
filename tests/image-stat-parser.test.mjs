import { describe, it } from 'node:test';
import assert from 'node:assert';
import { extractItemName, parseStats } from '../src/lib/imageStatParser.mjs';

describe('extractItemName', () => {
  it('extracts name from first line', () => {
    const text = '노가다 목장갑\n공격력 : +5\nSTR : +3';
    assert.strictEqual(extractItemName(text), '노가다 목장갑');
  });

  it('strips stat suffix from name line', () => {
    const text = '무스펠 펜던트 STR : 12\nDEX : +7\nLUK : +5';
    assert.strictEqual(extractItemName(text), '무스펠 펜던트');
  });

  it('returns empty string for empty input', () => {
    assert.strictEqual(extractItemName(''), '');
    assert.strictEqual(extractItemName('\n\n'), '');
  });

  it('handles English item names', () => {
    const text = 'Arcane Umbra Hat\nSTR : +40\nDEX : +30';
    assert.strictEqual(extractItemName(text), 'Arcane Umbra Hat');
  });

  it('strips Korean stat label suffixes', () => {
    const text = '파란 망토 공격력 : +3\n마력 : +1';
    assert.strictEqual(extractItemName(text), '파란 망토');
  });

  it('strips HP/MP with optional space from name line', () => {
    const text = '무스펠 투구 최대 HP : +15\nSTR : +5';
    assert.strictEqual(extractItemName(text), '무스펠 투구');
  });

  it('strips enhancement level notation (+N)', () => {
    const text = '드래곤 퍼플 슬리브 (+6)\nREQLEV:110\nLUK:7';
    assert.strictEqual(extractItemName(text), '드래곤 퍼플 슬리브');
  });

  it('strips (+N) even when OCR misreads the item name', () => {
    const text = '드래곤 퍼플 슬레브 (+6)\nREQLEV:110\n공격력 : 66';
    assert.strictEqual(extractItemName(text), '드래곤 퍼플 슬레브');
  });
});

describe('parseStats', () => {
  it('parses STR/DEX/INT/LUK', () => {
    const text = 'STR : +12\nDEX : +7\nINT : +3\nLUK : +5';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, {
      str: 12,
      dex: 7,
      int: 3,
      luk: 5,
    });
  });

  it('parses Korean stat labels', () => {
    const text = '공격력 : +10\n마력 : +8\n최대HP : +50';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, {
      weaponAttack: 10,
      magicAttack: 8,
      maxHp: 50,
    });
  });

  it('parses stats without colon separator', () => {
    const text = 'STR +15\nDEX +9';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, { str: 15, dex: 9 });
  });

  it('parses case-insensitive English labels', () => {
    const text = 'str : +10\nStr: +5';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, { str: 5 }); // last value wins
  });

  it('returns empty object for text with no stats', () => {
    const stats = parseStats('No stats here\nJust item description');
    assert.deepStrictEqual(stats, {});
  });

  it('parses mixed Korean and English labels', () => {
    const text = 'STR : +12\nDEX : +7\n공격력 : +3';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, { str: 12, dex: 7, weaponAttack: 3 });
  });

  it('handles negative values (no match for minus sign)', () => {
    const text = 'STR : -3';
    const stats = parseStats(text);
    // Pattern looks for +? only — negative values are not matched, expected behavior
    assert.deepStrictEqual(stats, {});
  });

  it('parses defense stats', () => {
    const text = '물리방어력 : +45\n마법방어력 : +30';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, { weaponDefense: 45, magicDefense: 30 });
  });

  it('parses HP/MP with space before colon', () => {
    const text = '최대 HP : +30\n최대 MP : +20';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, { maxHp: 30, maxMp: 20 });
  });

  it('handles accuracy and avoidability', () => {
    const text = '명중률 : +24\n회피율 : +15';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, { accuracy: 24, avoidability: 15 });
  });

  it('handles speed and jump', () => {
    const text = '이동속도 : +10\n점프력 : +5';
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, { speed: 10, jump: 5 });
  });

  it('ignores REQ-prefixed requirement lines', () => {
    const text = 'REQSTR:0\nREQDEX:150\nREQINT:0\nREQLUK:320\nLUK:7\nSTR : +3';
    const stats = parseStats(text);
    // Only standalone LUK:7 and STR:+3 should be parsed
    // REQSTR (contains STR but not at word start) must be ignored
    assert.deepStrictEqual(stats, { luk: 7, str: 3 });
  });

  it('parses a realistic MapleStory item tooltip', () => {
    const text = `드래곤 퍼플 슬리브 (+6)
REQLEV:110
REQSTR:0
REQDEX:150
REQINT:0
REQLUK:320
공격속도 : 빠름
LUK:7
공격력 : 66
명중률 : 6
회피율 : 7
업그레이드 가능 횟수 : 0`;
    const stats = parseStats(text);
    assert.deepStrictEqual(stats, {
      luk: 7,
      weaponAttack: 66,
      accuracy: 6,
      avoidability: 7,
    });
  });
});
