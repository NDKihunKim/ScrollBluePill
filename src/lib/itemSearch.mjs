export function normalizeSearchText(value) {
  return String(value).trim().replace(/\s+/g, '').toLocaleLowerCase('ko-KR');
}

export function buildSpacedNameInitials(value) {
  const words = String(value).trim().split(/\s+/).filter(Boolean);

  if (words.length < 2) {
    return '';
  }

  return normalizeSearchText(words.map((word) => [...word][0]).join(''));
}

function scoreTextMatch(query, value, exactScore, prefixScore, includesScore) {
  const normalizedValue = normalizeSearchText(value);

  if (!normalizedValue) {
    return 0;
  }

  if (normalizedValue === query) {
    return exactScore;
  }

  if (normalizedValue.startsWith(query)) {
    return prefixScore;
  }

  if (normalizedValue.includes(query)) {
    return includesScore;
  }

  return 0;
}

export function scoreItemMatch(query, item) {
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery.length < 2) {
    return 0;
  }

  const scores = [
    scoreTextMatch(normalizedQuery, item.nameKo, 100, 85, 70),
    scoreTextMatch(normalizedQuery, buildSpacedNameInitials(item.nameKo), 84, 69, 0),
    scoreTextMatch(normalizedQuery, item.nameEn, 80, 45, 25),
    ...(item.aliases ?? []).map((alias) => scoreTextMatch(normalizedQuery, alias, 95, 80, 65)),
  ];

  return Math.max(...scores);
}

export function searchKoreanItems(query, { items = [], limit = 10 } = {}) {
  const normalizedQuery = normalizeSearchText(query);

  if (normalizedQuery.length < 2) {
    return [];
  }

  return items
    .map((item) => ({ item, score: scoreItemMatch(normalizedQuery, item) }))
    .filter((result) => result.score > 0)
    .sort((a, b) => b.score - a.score || a.item.nameKo.localeCompare(b.item.nameKo, 'ko-KR'))
    .slice(0, limit)
    .map((result) => result.item);
}
