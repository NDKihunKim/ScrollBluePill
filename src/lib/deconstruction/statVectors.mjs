export function projectVector(stats, targetKeys) {
  return Object.fromEntries(targetKeys.map((key) => [key, Number(stats?.[key]) || 0]));
}

export function addVectors(left, right, targetKeys) {
  return Object.fromEntries(targetKeys.map((key) => [key, (left?.[key] || 0) + (right?.[key] || 0)]));
}

export function subtractVectors(left, right, targetKeys) {
  return Object.fromEntries(targetKeys.map((key) => [key, (left?.[key] || 0) - (right?.[key] || 0)]));
}

export function isExactVector(left, right, targetKeys) {
  return targetKeys.every((key) => (left?.[key] || 0) === (right?.[key] || 0));
}

export function vectorKey(vector, targetKeys) {
  return targetKeys.map((key) => `${key}:${vector?.[key] || 0}`).join('|');
}
