import {
  ALL_TARGET_STAT_KEYS,
  getDefaultCheckedStats,
} from './targetExtraction.mjs';
import { statLabelByKey } from '../scrollState.mjs';
import {
  DEFAULT_TRIAL_COUNT,
  computeAttemptsForPercentile,
  computeCumulativeProbability,
} from './monteCarloEngine.mjs';
export { DEFAULT_TRIAL_COUNT };
import {
  formatProbability,
  formatCalculationLabel,
  isResultStale,
  createResultSummary,
} from './resultFormatter.mjs';
import { renderAttemptChart } from './chartRenderer.mjs';

export const PLACEHOLDER_TEXT = '강화 목표를 설정한 뒤 기대값 계산을 눌러주세요.';
export const NO_STRATEGY_TEXT = '현재 지원되는 방법으로는 목표 아이템을 만들 수 없습니다.';
export const STALE_LABEL = '설정 변경됨 · 다시 계산 필요';
export const CONFIRM_TEXT = '계산 결과가 초기화됩니다. 변경하시겠습니까?';
export const CONFIRM_BUTTON_TEXT = '변경하기';
export const CANCEL_BUTTON_TEXT = '취소';
export const CALCULATE_LABEL = '기대값 계산';
export const START_BUTTON_TEXT = '계산 시작';
export const CANCEL_LABEL = '계산 취소';
export const MIN_TRIALS = 1000;
export const MAX_TRIALS = 10000000;
export const TRIAL_STEP = 10000;

export function createResultMutationGuard({ hasResult, clearResult, requestConfirmation }) {
  return (mutation) => {
    if (typeof mutation !== 'function') return;
    if (!hasResult()) {
      mutation();
      return;
    }

    requestConfirmation(() => {
      clearResult();
      mutation();
    });
  };
}

/**
 * Rounds a trial count to the nearest TRIAL_STEP and clamps to [MIN_TRIALS, MAX_TRIALS].
 *
 * @param {number} value - Raw trial count value
 * @returns {number} Rounded and clamped trial count
 */
export function roundTrialCount(value) {
  const rounded = Math.round(value / TRIAL_STEP) * TRIAL_STEP;
  return Math.max(MIN_TRIALS, Math.min(MAX_TRIALS, rounded));
}

function formatPercentInputValue(probability) {
  if (probability >= 1.0) return '100.00';
  if (probability <= 0) return '0';
  return (probability * 100).toFixed(2);
}

export function computeTopPercentForCount(successProbability, count) {
  const parsedCount = parseInt(count, 10);
  if (!Number.isFinite(parsedCount) || parsedCount < 0) return '';

  return formatPercentInputValue(
    computeCumulativeProbability(successProbability, parsedCount),
  );
}

export function computeCountForTopPercent(successProbability, topPercent, preferredCount) {
  const parsedPercent = parseFloat(topPercent);
  if (!Number.isFinite(parsedPercent) || parsedPercent < 0) return '';

  const preferredPercent = computeTopPercentForCount(successProbability, preferredCount);
  if (preferredPercent !== '' && Number(preferredPercent) === parsedPercent) {
    return parseInt(preferredCount, 10);
  }

  const attempts = computeAttemptsForPercentile(successProbability, parsedPercent / 100);
  return Number.isFinite(attempts) ? attempts : '';
}

/**
 * Creates DOM elements for the target selection view.
 *
 * @param {Record<string, number>} cleanStats - Clean base item stats
 * @param {Record<string, number>} previewStats - Enhanced preview item stats
 * @param {number|null} previewGradeClass - The grade class value of the preview item
 * @param {Record<string, number>} gains - Enhancement gains from computeEnhancementGains
 * @returns {{ container: HTMLElement, getCheckedStats: () => { [statKey: string]: boolean, grade: boolean }, getTrialCount: () => number, onStart: (fn: Function) => void, onCancel: (fn: Function) => void }}
 */
export function createTargetSelectionUI(cleanStats, previewStats, previewGradeClass, gains, { showCancel = false } = {}) {
  const container = document.createElement('div');
  container.className = 'ev-target-selection';

  // Header
  const header = document.createElement('h3');
  header.className = 'ev-target-header';
  header.textContent = '목표 조건 선택';
  container.appendChild(header);

  const defaultChecked = getDefaultCheckedStats(gains);
  const checkboxes = {};

  const chipGrid = document.createElement('div');
  chipGrid.className = 'ev-target-chip-grid';
  container.appendChild(chipGrid);

  for (const statKey of ALL_TARGET_STAT_KEYS) {
    const gain = gains[statKey];
    if (!gain || gain <= 0) {
      continue;
    }

    const label = document.createElement('label');
    label.className = 'ev-target-chip';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = defaultChecked[statKey];
    checkbox.dataset.statKey = statKey;

    const displayName = statLabelByKey[statKey] ?? statKey;
    const chipLabel = document.createElement('span');
    chipLabel.className = 'ev-target-chip-label';
    chipLabel.textContent = `${displayName} +${gain} 이상`;
    label.append(checkbox, chipLabel);

    chipGrid.appendChild(label);
    checkboxes[statKey] = checkbox;
  }

  const gradeLabel = document.createElement('label');
  gradeLabel.className = 'ev-target-chip ev-target-grade';
  const gradeCheckbox = document.createElement('input');
  gradeCheckbox.type = 'checkbox';
  gradeCheckbox.checked = false;
  gradeCheckbox.dataset.statKey = 'grade';
  const gradeChipLabel = document.createElement('span');
  gradeChipLabel.className = 'ev-target-chip-label';
  gradeChipLabel.textContent = '등급 현재 이상';
  gradeLabel.append(gradeCheckbox, gradeChipLabel);
  chipGrid.appendChild(gradeLabel);

  // Trial count input
  const trialRow = document.createElement('div');
  trialRow.className = 'ev-trial-row';
  const trialLabel = document.createElement('label');
  trialLabel.textContent = '시뮬레이션 횟수:';
  const trialInput = document.createElement('input');
  trialInput.type = 'number';
  trialInput.min = String(MIN_TRIALS);
  trialInput.max = String(MAX_TRIALS);
  trialInput.step = String(TRIAL_STEP);
  trialInput.value = String(DEFAULT_TRIAL_COUNT);
  trialInput.className = 'ev-trial-input';
  trialRow.append(trialLabel, trialInput);
  container.appendChild(trialRow);

  // Buttons
  const buttonRow = document.createElement('div');
  buttonRow.className = 'ev-button-row';

  const startButton = document.createElement('button');
  startButton.className = 'ev-start-btn';
  startButton.dataset.evCalcStart = '';
  startButton.textContent = START_BUTTON_TEXT;
  startButton.disabled = true;

  const cancelButton = document.createElement('button');
  cancelButton.className = 'ev-cancel-btn';
  cancelButton.textContent = CANCEL_BUTTON_TEXT;

  buttonRow.append(startButton);
  if (showCancel) {
    buttonRow.append(cancelButton);
  }
  container.appendChild(buttonRow);

  /**
   * Returns the current checked state of all target stat checkboxes.
   *
   * @returns {{ [statKey: string]: boolean, grade: boolean }}
   */
  function getCheckedStats() {
    const result = { grade: gradeCheckbox.checked };
    for (const statKey of ALL_TARGET_STAT_KEYS) {
      if (statKey === 'grade') continue;
      result[statKey] = checkboxes[statKey]?.checked ?? false;
    }
    return result;
  }

  /**
   * Returns the current trial count, rounded and clamped.
   *
   * @returns {number}
   */
  function getTrialCount() {
    const raw = parseInt(trialInput.value, 10);
    return roundTrialCount(Number.isFinite(raw) ? raw : DEFAULT_TRIAL_COUNT);
  }

  /**
   * Binds a click handler to the start button.
   *
   * @param {Function} fn - Click handler
   */
  function onStart(fn) {
    startButton.addEventListener('click', fn);
  }

  /**
   * Binds a click handler to the cancel button.
   *
   * @param {Function} fn - Click handler
   */
  function onCancel(fn) {
    cancelButton.addEventListener('click', fn);
  }

  return { container, getCheckedStats, getTrialCount, onStart, onCancel };
}

/**
 * Creates DOM elements for result display.
 *
 * @returns {{ container: HTMLElement, update: (resultSummary: object) => void, showStale: () => void, hideStale: () => void, showNoStrategy: () => void, showZeroSuccess: (trialCount: number) => void }}
 */
export function createResultUI() {
  const container = document.createElement('div');
  container.className = 'ev-result';

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'ev-result-title';
  titleEl.textContent = '장비 기대값';
  container.appendChild(titleEl);

  // Stale label (hidden by default)
  const staleLabel = document.createElement('div');
  staleLabel.className = 'ev-stale-label';
  staleLabel.textContent = STALE_LABEL;
  staleLabel.hidden = true;
  container.appendChild(staleLabel);

  // Canvas element for chart
  const canvas = document.createElement('canvas');
  canvas.className = 'ev-chart';
  container.appendChild(canvas);

  // Equipment count (expected attempts)
  const equipmentCount = document.createElement('div');
  equipmentCount.className = 'ev-equipment-count';
  container.appendChild(equipmentCount);

  // Interactive percentile ↔ count converter
  const converterRow = document.createElement('div');
  converterRow.className = 'ev-converter-row';

  const percentField = document.createElement('label');
  percentField.className = 'ev-converter-field';
  const percentPrefix = document.createElement('span');
  percentPrefix.textContent = '상위';
  const percentInput = document.createElement('input');
  percentInput.type = 'number';
  percentInput.min = '0';
  percentInput.max = '100';
  percentInput.step = '0.01';
  percentInput.className = 'ev-percent-input';
  const percentSuffix = document.createElement('span');
  percentSuffix.textContent = '%';
  percentField.append(percentPrefix, percentInput, percentSuffix);

  const converterArrow = document.createElement('span');
  converterArrow.className = 'ev-converter-arrow';
  converterArrow.textContent = '⇄';

  const countField = document.createElement('label');
  countField.className = 'ev-converter-field';
  const countPrefix = document.createElement('span');
  countPrefix.textContent = '시도 횟수:';
  const countInput = document.createElement('input');
  countInput.type = 'number';
  countInput.min = '0';
  countInput.max = '1000000';
  countInput.step = '1';
  countInput.className = 'ev-count-input';
  const countSuffix = document.createElement('span');
  countSuffix.textContent = '번';
  countField.append(countPrefix, countInput, countSuffix);

  converterRow.append(percentField, converterArrow, countField);
  container.appendChild(converterRow);

  // Best found method (details, collapsed by default)
  const details = document.createElement('details');
  details.className = 'ev-best-method';
  const summary = document.createElement('summary');
  summary.textContent = 'Best found method';
  details.appendChild(summary);
  const bestMethodContent = document.createElement('div');
  bestMethodContent.className = 'ev-best-method-content';
  details.appendChild(bestMethodContent);
  container.appendChild(details);

  /**
   * Updates the percentile input from the current count input value.
   */
  function updatePercentFromCount() {
    const p = parseFloat(countInput.dataset.successProbability || '0');
    const n = parseInt(countInput.value, 10);
    if (Number.isFinite(n) && n >= 0) {
      const cumulative = computeCumulativeProbability(p, n);
      percentInput.value = formatPercentInputValue(cumulative);
    } else {
      percentInput.value = '';
    }
  }

  /**
   * Updates the count input from the current percentile input value.
   */
  function updateCountFromPercent() {
    const p = parseFloat(percentInput.dataset.successProbability || '0');
    const count = computeCountForTopPercent(p, percentInput.value, countInput.value);
    countInput.value = count === '' ? '' : String(count);
  }

  percentInput.addEventListener('input', updateCountFromPercent);
  countInput.addEventListener('input', updatePercentFromCount);

  /**
   * Fills all displays from a createResultSummary output and renders the chart.
   *
   * @param {object} resultSummary - Result summary from createResultSummary
   */
  function update(resultSummary) {
    equipmentCount.textContent = `평균 장비 갯수: ${resultSummary.expectedAttempts.toLocaleString('en-US')}개`;

    percentInput.dataset.successProbability = resultSummary.successProbability;
    countInput.dataset.successProbability = resultSummary.successProbability;
    countInput.value = resultSummary.expectedAttempts;
    updatePercentFromCount();

    renderAttemptChart(canvas, resultSummary.chartData);

    if (resultSummary.bestStrategy) {
      bestMethodContent.textContent = JSON.stringify(resultSummary.bestStrategy, null, 2);
      details.hidden = false;
    } else {
      details.hidden = true;
    }

    staleLabel.hidden = true;
  }

  /** Shows the stale label. */
  function showStale() {
    staleLabel.hidden = false;
  }

  /** Hides the stale label. */
  function hideStale() {
    staleLabel.hidden = true;
  }

  /** Shows the no-strategy message. */
  function showNoStrategy() {
    equipmentCount.textContent = NO_STRATEGY_TEXT;
    percentInput.value = '';
    countInput.value = '';
    details.hidden = true;
    staleLabel.hidden = true;
  }

  /**
   * Shows a zero-success message with an upper bound.
   *
   * @param {number} trialCount - Number of simulation trials
   */
  function showZeroSuccess(trialCount) {
    if (trialCount > 0) {
      equipmentCount.textContent = `성공 확률: 0% (상한 < 1/${trialCount.toLocaleString('en-US')})`;
    } else {
      equipmentCount.textContent = '성공 확률: 0%';
    }
    percentInput.value = '';
    countInput.value = '';
    staleLabel.hidden = true;
  }

  return {
    container,
    update,
    showStale,
    hideStale,
    showNoStrategy,
    showZeroSuccess,
  };
}
