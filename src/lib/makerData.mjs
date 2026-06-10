import { weaponKinds } from './calculatorInput.mjs';

export const GEM_GRADES = ['하급', '중급', '상급'];

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
  maxHp: 'MaxHP',
  maxMp: 'MaxMP',
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
  { key: 'diamond',     nameKo: '다이아몬드',       stat: 'weaponAttack', weaponOnly: true,  values: [1, 2, 3] },
  { key: 'sapphire',    nameKo: '사파이어',         stat: 'magicAttack',  weaponOnly: true,  values: [1, 2, 3] },
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

export function computeGemSlotCount(requiredLevel) {
  const level = Number.isFinite(requiredLevel) ? requiredLevel : 0;
  if (level < 48) return 0;
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

  return GEM_TYPES.filter((gem) => {
    if (gem.weaponOnly && !isWeapon) return false;
    return true;
  }).map((gem) => ({
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
  diamond:     { low: 0, mid: 0, high: 0 },
  sapphire:    { low: 0, mid: 0, high: 0 },
  strCrystal:  { low: 0, mid: 0, high: 0 },
  dexCrystal:  { low: 0, mid: 0, high: 0 },
  intCrystal:  { low: 0, mid: 0, high: 0 },
  lukCrystal:  { low: 0, mid: 0, high: 0 },
  garnet:      { low: 0, mid: 0, high: 0 },
  opal:        { low: 0, mid: 0, high: 0 },
  amethyst:    { low: 0, mid: 0, high: 0 },
  aquamarine:  { low: 0, mid: 0, high: 0 },
  topaz:       { low: 0, mid: 0, high: 0 },
  emerald:     { low: 0, mid: 0, high: 0 },
};
