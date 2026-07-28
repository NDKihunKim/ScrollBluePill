export const knownItemLevelUpStatKeys = new Set([
  'str',
  'dex',
  'int',
  'luk',
  'maxHp',
  'maxMp',
  'weaponAttack',
  'magicAttack',
  'weaponDefense',
  'magicDefense',
  'accuracy',
  'avoidability',
  'speed',
  'jump',
]);

const expectedMaxLevelUpsByKind = {
  reverse: 3,
  timeless: 5,
};

export function normalizeItemLevelUpRange(range) {
  if (range == null || typeof range !== 'object') {
    return null;
  }

  const min = Number(range.min);
  const max = Number(range.max);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return null;
  }

  return { min, max };
}

function templateStatRanges(seed, templateKey) {
  const template = seed?.templates?.[templateKey];
  return template?.statRanges ?? {};
}

export function resolveStatRanges(seed, entry) {
  const mergedRanges = {
    ...templateStatRanges(seed, entry?.templateKey),
    ...(entry?.statRanges ?? {}),
  };
  const statRanges = {};

  for (const [statKey, range] of Object.entries(mergedRanges)) {
    if (!knownItemLevelUpStatKeys.has(statKey)) {
      continue;
    }

    const normalizedRange = normalizeItemLevelUpRange(range);
    if (normalizedRange) {
      statRanges[statKey] = normalizedRange;
    }
  }

  return statRanges;
}

export function resolveItemLevelUpRuntimeRows(seed) {
  return (seed?.items ?? []).map((entry) => ({
    itemId: entry.itemId,
    levelUpKind: entry.levelUpKind,
    maxLevelUps: entry.maxLevelUps,
    templateKey: entry.templateKey,
    statRanges: resolveStatRanges(seed, entry),
    sourceNameKo: entry.sourceNameKo,
    sourceUrl: entry.sourceUrl ?? seed.sourceUrl,
    sourceNote: entry.sourceNote ?? seed.sourceNote,
  }));
}

export function validateItemLevelUpSeed(seed, items) {
  const errors = [];
  const itemIds = new Set((Array.isArray(items) ? items : []).map((item) => item.id));
  const seenItemIds = new Set();
  const templates = seed?.templates ?? {};
  const entries = seed?.items ?? [];

  if (typeof seed?.sourceUrl !== 'string' || !/^https?:\/\//.test(seed.sourceUrl)) {
    errors.push('sourceUrl must be an absolute HTTP(S) URL');
  }

  for (const [templateKey, template] of Object.entries(templates)) {
    const statRanges = template?.statRanges;
    if (statRanges == null || typeof statRanges !== 'object') {
      errors.push(`template ${templateKey} must define statRanges`);
      continue;
    }

    for (const [statKey, range] of Object.entries(statRanges)) {
      if (!knownItemLevelUpStatKeys.has(statKey)) {
        errors.push(`template ${templateKey} uses unknown stat key ${statKey}`);
      }
      if (!normalizeItemLevelUpRange(range)) {
        errors.push(`template ${templateKey} has invalid range for ${statKey}`);
      }
    }
  }

  for (const entry of entries) {
    const entryLabel = entry?.sourceNameKo ?? entry?.itemId ?? '<unknown>';
    const expectedMaxLevelUps = expectedMaxLevelUpsByKind[entry?.levelUpKind];

    if (seenItemIds.has(entry?.itemId)) {
      errors.push(`duplicate itemId ${entry.itemId}`);
    }
    seenItemIds.add(entry?.itemId);

    if (!itemIds.has(entry?.itemId)) {
      errors.push(`itemId ${entry?.itemId} for ${entryLabel} does not exist in local items`);
    }

    if (!expectedMaxLevelUps) {
      errors.push(`${entryLabel} has invalid levelUpKind ${entry?.levelUpKind}`);
    } else if (entry?.maxLevelUps !== expectedMaxLevelUps) {
      errors.push(`${entryLabel} ${entry.levelUpKind} must use maxLevelUps ${expectedMaxLevelUps}`);
    }

    if (!Object.hasOwn(templates, entry?.templateKey)) {
      errors.push(`${entryLabel} references unknown template ${entry?.templateKey}`);
    }

    for (const [statKey, range] of Object.entries(entry?.statRanges ?? {})) {
      if (!knownItemLevelUpStatKeys.has(statKey)) {
        errors.push(`${entryLabel} uses unknown stat key ${statKey}`);
      }
      if (!normalizeItemLevelUpRange(range)) {
        errors.push(`${entryLabel} has invalid range for ${statKey}`);
      }
    }

    if (Object.keys(resolveStatRanges(seed, entry)).length === 0) {
      errors.push(`${entryLabel} resolves to empty statRanges`);
    }
  }

  return {
    itemCount: entries.length,
    errors,
  };
}
