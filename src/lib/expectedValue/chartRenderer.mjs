import { formatKoreanNumber } from '../formatKoreanNumber.mjs';

const DEFAULT_CHART_HEIGHT = 220;
const X_TICK_MIN_GAP = 8;

function ensureCanvasDisplaySize(canvas) {
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.maxWidth = '100%';
  canvas.style.height ||= `${DEFAULT_CHART_HEIGHT}px`;
}

function selectNonOverlappingXAxisTicks(ctx, percentiles, paddingLeft, plotWidth) {
  const ticks = percentiles.map((percentile) => {
    const label = `${percentile}%`;
    const x = paddingLeft + (percentile / 100) * plotWidth;
    const halfWidth = ctx.measureText(label).width / 2;
    return { percentile, label, x, left: x - halfWidth, right: x + halfWidth };
  });

  if (ticks.length <= 2) return ticks;

  const prioritized = [ticks[0], ticks[ticks.length - 1], ...ticks.slice(1, -1)];
  const selected = [];

  for (const tick of prioritized) {
    const overlaps = selected.some((existing) =>
      tick.left < existing.right + X_TICK_MIN_GAP &&
      tick.right + X_TICK_MIN_GAP > existing.left
    );
    if (!overlaps) selected.push(tick);
  }

  return selected.sort((a, b) => a.percentile - b.percentile);
}

/**
 * Renders an inverse-CDF line chart: X-axis = cumulative probability (percentile),
 * Y-axis = number of clean-item attempts needed.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to render into
 * @param {Array<{ percentile: number, attempts: number }>} chartData - Inverse CDF points
 * @param {number} _p95 - Unused; kept for backward compatibility
 */
export function renderAttemptChart(canvas, chartData, _p95) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ensureCanvasDisplaySize(canvas);

  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();

  const width = rect.width || canvas.parentElement?.clientWidth || 640;
  const height = rect.height || DEFAULT_CHART_HEIGHT;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  ctx.scale(dpr, dpr);

  // --- Theme detection ---
  const theme =
    document.documentElement.getAttribute('data-theme') || 'light';
  const isDark = theme === 'dark';

  const colors = {
    line: isDark ? '#4A9EFF' : '#3B82F6',
    area: isDark ? 'rgba(74,158,255,0.08)' : 'rgba(59,130,246,0.08)',
    grid: isDark ? '#374151' : '#E5E7EB',
    text: isDark ? '#D1D5DB' : '#6B7280',
    marker: isDark ? '#EF4444' : '#DC2626',
    referenceLine: isDark ? '#F59E0B' : '#D97706',
    background: isDark ? '#1F2937' : '#FFFFFF',
  };

  // --- Layout ---
  const padding = { top: 28, right: 20, bottom: 40, left: 60 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  if (plotW <= 0 || plotH <= 0 || chartData.length === 0) return;

  // --- Clear ---
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  // --- Data ranges ---
  const maxPercentile = chartData.length > 0
    ? chartData[chartData.length - 1].percentile
    : 99;
  const maxAttempts = chartData.length > 0
    ? Math.max(...chartData.map((d) => d.attempts), 1)
    : 10;

  // --- Horizontal grid lines (attempt counts) ---
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;

  const yTicks = computeNiceTicks(0, maxAttempts, 4);
  for (const yVal of yTicks) {
    const y = padding.top + plotH - (yVal / maxAttempts) * plotH;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    // Y-axis label
    ctx.fillStyle = colors.text;
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(formatYAxisTick(yVal), padding.left - 8, y);
  }

  // --- X-axis labels (percentiles) ---
  ctx.fillStyle = colors.text;
  ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  const xTickPercentiles = [0, 25, 50, 75, 90, 95, 99];
  const visibleXTickPercentiles = xTickPercentiles.filter((pct) => pct <= maxPercentile);
  const xTicks = selectNonOverlappingXAxisTicks(
    ctx,
    visibleXTickPercentiles,
    padding.left,
    plotW,
  );
  for (const tick of xTicks) {
    ctx.fillText(tick.label, tick.x, height - padding.bottom + 24);
  }

  // --- X-axis title ---
  ctx.font = '12px sans-serif';
  ctx.fillText(
    '누적 확률',
    padding.left + plotW / 2,
    height - padding.bottom + 8,
  );

  // --- Y-axis title ---
  ctx.save();
  ctx.translate(22, padding.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('시도 횟수', 0, 0);
  ctx.restore();

  // --- Vertical reference lines at key percentiles ---
  ctx.strokeStyle = colors.referenceLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);

  const refPercentiles = [50, 75, 90, 95];
  for (const pct of refPercentiles) {
    if (pct > maxPercentile) continue;
    const x = padding.left + (pct / 100) * plotW;
    ctx.beginPath();
    ctx.moveTo(x, padding.top);
    ctx.lineTo(x, padding.top + plotH);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  // --- Area fill under the curve ---
  ctx.fillStyle = colors.area;
  ctx.beginPath();

  // Start from bottom-left corner of the plot area
  ctx.moveTo(padding.left, padding.top + plotH);

  for (const d of chartData) {
    const cx = padding.left + (d.percentile / 100) * plotW;
    const cy = padding.top + plotH - (d.attempts / maxAttempts) * plotH;
    ctx.lineTo(cx, cy);
  }

  // Close path back to bottom
  ctx.lineTo(
    padding.left + (maxPercentile / 100) * plotW,
    padding.top + plotH,
  );
  ctx.closePath();
  ctx.fill();

  // --- Main curve line ---
  ctx.strokeStyle = colors.line;
  ctx.lineWidth = 2;
  ctx.beginPath();

  let firstPoint = true;
  for (const d of chartData) {
    const cx = padding.left + (d.percentile / 100) * plotW;
    const cy = padding.top + plotH - (d.attempts / maxAttempts) * plotH;

    if (firstPoint) {
      ctx.moveTo(cx, cy);
      firstPoint = false;
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();

  // --- Dot markers at key percentiles ---
  for (const pct of refPercentiles) {
    // Find the closest data point
    let closest = null;
    let bestDist = Infinity;
    for (const d of chartData) {
      const dist = Math.abs(d.percentile - pct);
      if (dist < bestDist) {
        bestDist = dist;
        closest = d;
      }
    }
    if (!closest) continue;

    const dx = padding.left + (closest.percentile / 100) * plotW;
    const dy = padding.top + plotH - (closest.attempts / maxAttempts) * plotH;

    // White center dot
    ctx.fillStyle = colors.background;
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Colored ring
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(dx, dy, 4, 0, Math.PI * 2);
    ctx.stroke();

    // Label above the dot
    ctx.fillStyle = colors.text;
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(`${formatKoreanNumber(closest.attempts)}회`, dx, dy - 6);
  }
}

function formatYAxisTick(value) {
  return formatKoreanNumber(value);
}

/**
 * Computes "nice" tick values for a Y-axis range.
 *
 * @param {number} min - Minimum value
 * @param {number} max - Maximum value
 * @param {number} targetCount - Desired number of ticks
 * @returns {number[]}
 */
function computeNiceTicks(min, max, targetCount) {
  const range = max - min || 1;
  const rawStep = range / targetCount;

  // Round step to a nice number
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const residual = rawStep / magnitude;

  let niceStep;
  if (residual <= 1) niceStep = 1 * magnitude;
  else if (residual <= 2) niceStep = 2 * magnitude;
  else if (residual <= 5) niceStep = 5 * magnitude;
  else niceStep = 10 * magnitude;

  const ticks = [];
  let tick = Math.ceil(min / niceStep) * niceStep;
  while (tick <= max) {
    ticks.push(tick);
    tick += niceStep;
  }
  return ticks;
}
