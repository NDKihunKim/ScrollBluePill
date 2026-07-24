// ---- Shared item card helpers used by deconstruction + expected-value pages ----

export const requirementRows = [
  ['REQLEV', 'requiredLevel'],
  ['REQSTR', 'str'],
  ['REQDEX', 'dex'],
  ['REQINT', 'int'],
  ['REQLUK', 'luk'],
  ['REQPOP', 'pop'],
];

export const statRows = [
  ['공격속도', 'attackSpeed'],
  ['STR', 'str'],
  ['DEX', 'dex'],
  ['INT', 'int'],
  ['LUK', 'luk'],
  ['최대HP', 'maxHp'],
  ['최대MP', 'maxMp'],
  ['공격력', 'weaponAttack'],
  ['마력', 'magicAttack'],
  ['물리방어력', 'weaponDefense'],
  ['마법방어력', 'magicDefense'],
  ['명중률', 'accuracy'],
  ['회피율', 'avoidability'],
  ['이동속도', 'speed'],
  ['점프력', 'jump'],
  ['업그레이드 가능 횟수', 'upgradeSlots'],
];

export const jobKindByRequiredJob = {
  Beginner: '초보자',
  Warrior: '전사',
  Magician: '마법사',
  Bowman: '궁수',
  Thief: '도적',
  Pirate: '해적',
};

export const weaponAttackSpeedBySubCategory = {
  'One-Handed Sword': 5,
  'Two-Handed Sword': 6,
  'One-Handed Axe': 5,
  'Two-Handed Axe': 6,
  'One-Handed Blunt Weapon': 5,
  'Two-Handed Blunt': 6,
  Spear: 7,
  'Pole Arm': 8,
  Wand: 6,
  Staff: 8,
  Bow: 6,
  Crossbow: 6,
  Claw: 4,
  Dagger: 4,
  Knuckle: 5,
  Gun: 5,
};

export function formatRequiredJobs(requiredJobs = []) {
  const allJobs = ['초보자', '전사', '마법사', '궁수', '도적', '해적'];
  const equippableSet = new Set(
    (requiredJobs ?? []).length === 0 || (requiredJobs ?? []).includes('Beginner')
      ? allJobs
      : requiredJobs.map((job) => jobKindByRequiredJob[job]).filter(Boolean),
  );

  const row = document.createElement('div');
  row.className = 'selected-item-jobs-row';

  allJobs.forEach((job) => {
    const chip = document.createElement('span');
    chip.className = 'job-chip';
    chip.textContent = job;
    if (!equippableSet.has(job)) {
      chip.classList.add('job-chip--inactive');
    }
    row.append(chip);
  });

  return row;
}

export function formatRequirementValue(key, rawValue) {
  if (key === 'pop' && (rawValue === 0 || rawValue === null)) return '-';
  return rawValue;
}

export function createItemLine(label, value, className = '') {
  const row = document.createElement('div');
  row.className = `selected-item-line ${className}`.trim();

  const labelElement = document.createElement('span');
  labelElement.className = 'selected-item-line__label';
  labelElement.textContent = label;

  const valueWrapper = document.createElement('span');
  valueWrapper.className = 'selected-item-line__value';
  valueWrapper.append(document.createTextNode(' : '));

  const valueElement = document.createElement('strong');
  valueElement.textContent = String(value);
  valueWrapper.append(valueElement);

  row.append(labelElement, valueWrapper);
  return row;
}

export function resolveAttackSpeed(item, speedTable = weaponAttackSpeedBySubCategory) {
  if (Number.isFinite(item.stats?.attackSpeed)) {
    return item.stats.attackSpeed;
  }
  return speedTable[item.typeInfo?.subCategory] ?? null;
}

export function formatStatValue(key, value) {
  if (key === 'attackSpeed') {
    const speedLabelByValue = {
      2: '매우 빠름',
      3: '빠름',
      4: '빠름',
      5: '빠름',
      6: '보통',
      7: '느림',
      8: '느림',
      9: '매우 느림',
    };
    return speedLabelByValue[value] ?? '속도 정보 없음';
  }

  if (key === 'upgradeSlots' || value <= 0) {
    return value;
  }

  return `+${value}`;
}
