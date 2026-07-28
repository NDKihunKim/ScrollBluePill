// ---- Stat display helpers shared across deconstruction UI ----

export const STAT_PRIORITY = [
  'weaponAttack',
  'magicAttack',
  'str',
  'dex',
  'int',
  'luk',
  'maxHp',
  'maxMp',
  'weaponDefense',
  'magicDefense',
  'accuracy',
  'avoidability',
  'speed',
  'jump',
];

export const statLabelByKey = {
  weaponAttack: '공격력',
  magicAttack: '마력',
  str: 'STR',
  dex: 'DEX',
  int: 'INT',
  luk: 'LUK',
  maxHp: '최대HP',
  maxMp: '최대MP',
  weaponDefense: '물리방어력',
  magicDefense: '마법방어력',
  accuracy: '명중률',
  avoidability: '회피율',
  speed: '이동속도',
  jump: '점프력',
};

export const CORE_STATS = new Set(['str', 'dex', 'int', 'luk', 'weaponAttack', 'magicAttack']);

export const STAT_ORDER = [
  'str',
  'dex',
  'int',
  'luk',
  'weaponAttack',
  'magicAttack',
  'maxHp',
  'maxMp',
  'weaponDefense',
  'magicDefense',
  'accuracy',
  'avoidability',
  'speed',
  'jump',
  'attackSpeed',
  'upgradeSlots',
];
