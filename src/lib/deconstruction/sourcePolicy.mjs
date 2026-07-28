const NO_SOURCE_MESSAGE = '분석에 사용할 강화 유형을 하나 이상 선택해주세요';
const SCROLL_CONFLICT_MESSAGE =
  '주문서 성공 횟수가 1회 이상으로 설정되어 있어 주문서를 제외할 수 없습니다. 성공한 주문서가 있는 아이템은 주문서를 사용하지 않은 전략으로 분석할 수 없습니다.';

export const getDefaultSourceSelection = () => ({
  scrolls: false,
  stimulant: false,
  gems: false,
  itemLevelUp: false,
});

export const resolveAllowedSources = (
  selection,
  { itemLevelUpEligible = false, reset = false } = {},
) => {
  const current = reset ? getDefaultSourceSelection() : (selection ?? {});
  return {
    scrolls: Boolean(current.scrolls),
    stimulant: Boolean(current.stimulant),
    gems: Boolean(current.gems),
    itemLevelUp: itemLevelUpEligible && Boolean(current.itemLevelUp),
  };
};

export const getSourceValidationMessage = (allowedSources, successfulScrollCount) => {
  if (!Object.values(allowedSources).some(Boolean)) {
    return NO_SOURCE_MESSAGE;
  }
  if (!allowedSources.scrolls && successfulScrollCount > 0) {
    return SCROLL_CONFLICT_MESSAGE;
  }
  return '';
};
