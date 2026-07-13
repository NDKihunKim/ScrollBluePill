import { weaponKinds } from './calculatorInput.mjs';

export const GEM_GRADES = ['하급', '중급', '상급'];

/** Fallback icon ID for chaos scrolls — equipment-specific chaos scroll IDs
 *  (e.g. 2045000) don't have icons on the MapleStory.io API, but the
 *  generic Chaos Scroll (2049100) does. */
export const CHAOS_SCROLL_ICON_ID = 2049100;

export const STAT_KEY_RANK = {
  weaponAttack: 0,
  magicAttack: 1,
  str: 2,
  dex: 3,
  int: 4,
  luk: 5,
  accuracy: 6,
  avoidability: 7,
  speed: 8,
  jump: 9,
  maxHp: 10,
  maxMp: 11,
};

export const statLabelByKey = {
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  maxHp: '최대HP',
  maxMp: '최대MP',
  weaponAttack: '공격력',
  magicAttack: '마력',
  weaponDefense: '물리방어력',
  magicDefense: '마법방어력',
  accuracy: '명중률',
  avoidability: '회피율',
  speed: '이동속도',
  jump: '점프력',
};

export const GEM_TYPES = [
  { key: 'blackAmethyst', nameKo: '흑수정',         stat: null, weaponOnly: true,  behavior: 'variable', variableKeys: ['weaponAttack', 'magicAttack'], variableLimit: 3 },
  { key: 'diamond',     nameKo: '다이아몬드',       stat: 'weaponAttack', weaponOnly: true,  values: [1, 2, 3] },
  { key: 'sapphire',    nameKo: '사파이어',         stat: 'magicAttack',  weaponOnly: true,  values: [1, 2, 3] },
  { key: 'darkCrystal',  nameKo: '어둠의 크리스탈', stat: null, weaponOnly: false, behavior: 'variable', variableKeys: ['str', 'dex', 'int', 'luk'], variableLimit: 5 },
  { key: 'strCrystal',  nameKo: '힘의 크리스탈',    stat: 'str',          weaponOnly: false, values: [1, 3, 5] },
  { key: 'dexCrystal',  nameKo: '민첩의 크리스탈',  stat: 'dex',          weaponOnly: false, values: [1, 3, 5] },
  { key: 'intCrystal',  nameKo: '지혜의 크리스탈',  stat: 'int',          weaponOnly: false, values: [1, 3, 5] },
  { key: 'lukCrystal',  nameKo: '행운의 크리스탈',  stat: 'luk',          weaponOnly: false, values: [1, 3, 5] },
  { key: 'garnet',      nameKo: '가넷',             stat: 'accuracy',     weaponOnly: false, values: [2, 3, 5] },
  { key: 'opal',        nameKo: '오팔',             stat: 'avoidability', weaponOnly: false, values: [2, 3, 5] },
  { key: 'amethyst',    nameKo: '자수정',           stat: 'speed',        weaponOnly: false, values: [2, 3, 5] },
  { key: 'aquamarine',  nameKo: '아쿠아마린',       stat: 'jump',         weaponOnly: false, values: [1, 3, 5] },
  { key: 'topaz',       nameKo: '토파즈',           stat: 'maxHp',        weaponOnly: false, values: [10, 20, 30] },
  { key: 'emerald',     nameKo: '에메랄드',         stat: 'maxMp',        weaponOnly: false, values: [10, 20, 30] },
];

export function computeGemSlotCount(requiredLevel, requiredJobs = []) {
  const level = Number.isFinite(requiredLevel) ? requiredLevel : 0;

  // Maker gem eligibility thresholds by class:
  //   Magician-only → 48, everything else → 50
  //   Multi-class items use the strictest (highest) threshold.
  const jobs = requiredJobs ?? [];
  const isMagicianOnly = jobs.length === 1 && jobs[0] === 'Magician';
  const threshold = isMagicianOnly ? 48 : 50;

  if (level < threshold) return 0;
  if (level <= 77) return 1;
  if (level <= 105) return 2;
  return 3;
}

export function isWeaponKind(equipmentKind) {
  return weaponKinds.includes(equipmentKind);
}

export function getVisibleGemTypes(equipmentKind, usedGemKeys) {
  const isWeapon = isWeaponKind(equipmentKind);
  const used = new Set(usedGemKeys);

  return GEM_TYPES
    .filter((gem) => {
      if (gem.weaponOnly && !isWeapon) return false;
      return true;
    })
    .map((gem) => ({
      ...gem,
      disabled: used.has(gem.key),
    }));
}

export function getGemTypeByKey(key) {
  return GEM_TYPES.find((g) => g.key === key) ?? null;
}

export function getGemStatPriority(gemKey) {
  const gem = getGemTypeByKey(gemKey);
  if (!gem) return 99;
  return STAT_KEY_RANK[gem.stat] ?? 99;
}

export const GEM_ITEM_IDS = {
  diamond:     { base: 4021007, low: 4250000, mid: 4250001, high: 4250002 },
  sapphire:    { base: 4021005, low: 4250100, mid: 4250101, high: 4250102 },
  garnet:      { base: 4021000, low: 4250200, mid: 4250201, high: 4250202 },
  opal:        { base: 4021004, low: 4250300, mid: 4250301, high: 4250302 },
  amethyst:    { base: 4021001, low: 4250400, mid: 4250401, high: 4250402 },
  aquamarine:  { base: 4021002, low: 4250500, mid: 4250501, high: 4250502 },
  topaz:       { base: 4021006, low: 4250600, mid: 4250601, high: 4250602 },
  emerald:     { base: 4021003, low: 4250700, mid: 4250701, high: 4250702 },
  strCrystal:  { base: 4005000, low: 4250800, mid: 4250801, high: 4250802 },
  dexCrystal:  { base: 4005002, low: 4251100, mid: 4251101, high: 4251102 },
  intCrystal:  { base: 4005001, low: 4250900, mid: 4250901, high: 4250902 },
  lukCrystal:  { base: 4005003, low: 4251000, mid: 4251001, high: 4251002 },
  darkCrystal:  { base: 4005004, low: 4251400, mid: 4251401, high: 4251402 },
  blackAmethyst: { base: 4021008, low: 4251300, mid: 4251301, high: 4251302 },
};

/** Background colors for gem icon placeholders, keyed by stat */
export const GEM_STAT_COLORS = {
  weaponAttack:  '#e74c3c',
  magicAttack:   '#8e44ad',
  str:           '#e74c3c',
  dex:           '#27ae60',
  int:           '#2980b9',
  luk:           '#f39c12',
  accuracy:      '#e67e22',
  avoidability:  '#1abc9c',
  speed:         '#3498db',
  jump:          '#2ecc71',
  maxHp:         '#c0392b',
  maxMp:         '#2c3e50',
};
