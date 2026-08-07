import { ALL_TARGET_STAT_KEYS } from './targetExtraction.mjs';
import { computeAttemptsForPercentile, computeCumulativeProbability } from './geometricMath.mjs';
import { formatKoreanNumber, parseKoreanNumber } from '../formatKoreanNumber.mjs';

export {};

/**
 * Formats a trial count integer for display with thousands separators and the Korean 회 suffix.
 * e.g. 100000 → "100,000회"
 *
 * @param {number} value - Raw integer trial count
 * @returns {string} Formatted display string
 * @deprecated Trial count is no longer user-configurable. Kept for backward compat.
 */
function formatTrialDisplay(value) {
  return `${value.toLocaleString('en-US')}회`;
}

/**
 * Parses a trial count string back to a raw integer, stripping any formatting.
 * Handles values like "100,000회", "100000", or "100000회".
 *
 * @param {string} raw - Display or input string
 * @returns {number} Raw integer trial count
 * @deprecated Trial count is no longer user-configurable. Kept for backward compat.
 */
function parseTrialInput(raw) {
  const cleaned = String(raw).replace(/[^0-9]/g, '');
  const parsed = parseInt(cleaned, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 100000;
}

import { formatProbability, createResultSummary } from './resultFormatter.mjs';
import { renderAttemptChart } from './chartRenderer.mjs';

export const PLACEHOLDER_TEXT = '강화 목표를 설정한 뒤 기대값 계산을 눌러주세요.';
export const NO_STRATEGY_TEXT = '현재 지원되는 방법으로는 목표 아이템을 만들 수 없습니다.';
const THRESHOLD_UNSUPPORTED_TEXT = '아직 지원하지 않는 조합입니다';
export const STALE_LABEL = '설정 변경됨 · 다시 계산 필요';
export const CONFIRM_TEXT = '계산 결과가 초기화됩니다. 변경하시겠습니까?';
export const CONFIRM_BUTTON_TEXT = '변경하기';
export const CANCEL_BUTTON_TEXT = '취소';
export const CALCULATE_LABEL = '기대값 계산';
export const START_BUTTON_TEXT = '계산 시작';
export const CANCEL_LABEL = '계산 취소';

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

function formatPercentInputValue(probability) {
  if (probability >= 1.0) return '100.00';
  if (probability <= 0) return '0';
  return (probability * 100).toFixed(2);
}

export function computeTopPercentForCount(successProbability, count) {
  const parsedCount = parseInt(count, 10);
  if (!Number.isFinite(parsedCount) || parsedCount < 0) return '';

  return formatPercentInputValue(computeCumulativeProbability(successProbability, parsedCount));
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
 * All stats with positive enhancement gains are automatically treated as
 * target conditions — no manual checkbox selection is required. The user
 * only needs to click the start button to run the calculation.
 *
 * @param {Record<string, number>} gains - Enhancement gains from computeEnhancementGains
 * @param {{ showCancel?: boolean }} [options]
 * @returns {{ container: HTMLElement, getCheckedStats: () => { [statKey: string]: boolean, grade: boolean }, onStart: (fn: Function) => void, onCancel: (fn: Function) => void }}
 */
export function createTargetSelectionUI(gains, { showCancel = false } = {}) {
  const container = document.createElement('div');
  container.className = 'ev-target-selection';

  // Header
  const header = document.createElement('h3');
  header.className = 'ev-target-header';
  header.textContent = '목표 조건 선택';
  container.appendChild(header);

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
   * Returns the auto-derived checked state for all target stats.
   * Every stat in ALL_TARGET_STAT_KEYS with a positive gain is treated
   * as checked. Grade is always unchecked. No user interaction needed.
   *
   * @returns {{ [statKey: string]: boolean, grade: boolean }}
   */
  function getCheckedStats() {
    const result = { grade: false };
    for (const statKey of ALL_TARGET_STAT_KEYS) {
      if (statKey === 'grade') continue;
      result[statKey] = (gains[statKey] ?? 0) > 0;
    }
    return result;
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

  return { container, getCheckedStats, onStart, onCancel };
}

/**
 * Creates DOM elements for result display.
 *
 * @returns {{ container: HTMLElement, update: (resultSummary: object) => void, showStale: () => void, hideStale: () => void, showNoStrategy: () => void, showZeroSuccess: () => void }}
 */
export function createResultUI() {
  const container = document.createElement('div');
  container.className = 'ev-result';

  // Title
  const titleEl = document.createElement('div');
  titleEl.className = 'ev-result-title';
  titleEl.textContent = '제작 시도 횟수 기대값';
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

  const equipmentCountText = document.createElement('span');
  equipmentCountText.className = 'ev-equipment-count-text';

  const helpButton = document.createElement('button');
  helpButton.className = 'ev-help-trigger';
  helpButton.type = 'button';
  helpButton.setAttribute('aria-label', '정확한 수치 보기');
  helpButton.textContent = '?';

  const helpTooltip = document.createElement('span');
  helpTooltip.className = 'ev-help-tooltip';
  helpButton.appendChild(helpTooltip);

  equipmentCount.append(equipmentCountText, helpButton);
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
  countPrefix.textContent = '시도 횟수';
  const countInput = document.createElement('input');
  countInput.type = 'text';
  countInput.inputMode = 'numeric';
  countInput.enterKeyHint = 'done';
  countInput.className = 'ev-count-input';
  let countRawValue = 0;
  const countSuffix = document.createElement('span');
  countSuffix.textContent = '회';
  countField.append(countPrefix, countInput, countSuffix);

  converterRow.append(percentField, converterArrow, countField);
  container.appendChild(converterRow);

  /**
   * Updates the percentile input from the current countRawValue.
   */
  function updatePercentFromCount() {
    const p = parseFloat(countInput.dataset.successProbability || '0');
    const n = countRawValue;
    if (Number.isFinite(n) && n >= 0) {
      const cumulative = computeCumulativeProbability(p, n);
      percentInput.value = formatPercentInputValue(cumulative);
    } else {
      percentInput.value = '';
    }
  }

  /**
   * Updates the count input from the current percentile input value.
   * Formats the display unless the count input is currently focused.
   */
  function updateCountFromPercent() {
    const p = parseFloat(percentInput.dataset.successProbability || '0');
    const count = computeCountForTopPercent(p, percentInput.value, countInput.value);
    if (count === '') {
      countRawValue = 0;
    } else {
      countRawValue = Number(count);
    }
    // Show formatted value unless the user is actively editing
    if (document.activeElement !== countInput) {
      countInput.value = formatKoreanNumber(countRawValue);
    } else {
      countInput.value = String(countRawValue);
    }
  }

  // ── Count input: focus/blur dual display ────────────────────────────
  // When idle: shows Korean-formatted value (e.g. "12.69억")
  // When focused: shows raw number for editing (e.g. "1269037573")

  countInput.addEventListener('focus', () => {
    countInput.value = String(countRawValue);
    countInput.select();
  });

  countInput.addEventListener('blur', () => {
    const parsed = parseKoreanNumber(countInput.value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      countRawValue = parsed;
    }
    countInput.value = formatKoreanNumber(countRawValue);
    updatePercentFromCount();
  });

  countInput.addEventListener('input', () => {
    const parsed = parseKoreanNumber(countInput.value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      countRawValue = parsed;
      updatePercentFromCount();
    }
    // If unparseable, wait for blur before updating
  });

  percentInput.addEventListener('input', updateCountFromPercent);

  /**
   * Fills all displays from a createResultSummary output and renders the chart.
   *
   * @param {object} resultSummary - Result summary from createResultSummary
   */
  let lastChartData = null;

  function update(resultSummary) {
    equipmentCountText.textContent = `평균 시도 횟수: ${formatKoreanNumber(resultSummary.expectedAttempts)}`;
    helpTooltip.textContent = resultSummary.expectedAttempts.toLocaleString('en-US');
    helpButton.hidden = false;

    percentInput.dataset.successProbability = resultSummary.successProbability;
    countInput.dataset.successProbability = resultSummary.successProbability;
    countRawValue = resultSummary.expectedAttempts;
    countInput.value = formatKoreanNumber(countRawValue);
    updatePercentFromCount();

    lastChartData = resultSummary.chartData;
    renderAttemptChart(canvas, lastChartData);

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
    equipmentCountText.textContent = NO_STRATEGY_TEXT;
    helpButton.hidden = true;
    percentInput.value = '';
    countInput.value = '';
    staleLabel.hidden = true;
  }

  /** Shows a message when threshold-mode computation is not yet supported. */
  function showThresholdUnsupported() {
    equipmentCountText.textContent = THRESHOLD_UNSUPPORTED_TEXT;
    helpButton.hidden = true;
    percentInput.value = '';
    countInput.value = '';
    staleLabel.hidden = true;
  }

  /**
   * Shows a zero-success message (exact probability = 0).
   */
  function showZeroSuccess() {
    equipmentCountText.textContent = '성공 확률: 0%';
    helpButton.hidden = true;
    percentInput.value = '';
    countInput.value = '';
    staleLabel.hidden = true;
  }

  /** Re-renders the chart with the last known data (e.g. after a theme change). */
  function rechart() {
    if (lastChartData) {
      renderAttemptChart(canvas, lastChartData);
    }
  }

  // Watch for theme changes so the chart re-renders with updated colors.
  const themeObserver = new MutationObserver(() => {
    if (lastChartData) rechart();
  });
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  return {
    container,
    update,
    showStale,
    hideStale,
    showNoStrategy,
    showThresholdUnsupported,
    showZeroSuccess,
    rechart,
    destroy: () => themeObserver.disconnect(),
  };
}
