const DEFAULT_CHART_HEIGHT = 220;

function ensureCanvasDisplaySize(canvas) {
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.maxWidth = '100%';
  canvas.style.height ||= `${DEFAULT_CHART_HEIGHT}px`;
}

/**
 * Renders an attempt-probability bar chart with a cumulative line and p95 marker
 * on the given HTMLCanvasElement using the Canvas 2D API.
 *
 * This module is intended for browser environments only (depends on Canvas API
 * and `document` global).
 *
 * @param {HTMLCanvasElement} canvas - The canvas element to render into
 * @param {Array<{ attempt: number, probability: number }>} chartData - Per-attempt PMF data
 * @param {number} p95 - The 95th-percentile attempt number (marker line position)
 */
export function renderAttemptChart(canvas, chartData, p95) {
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
    bar: isDark ? '#4A9EFF' : '#3B82F6',
    cumulative: isDark ? '#F59E0B' : '#D97706',
    grid: isDark ? '#374151' : '#E5E7EB',
    text: isDark ? '#D1D5DB' : '#6B7280',
    marker: isDark ? '#EF4444' : '#DC2626',
    background: isDark ? '#1F2937' : '#FFFFFF',
  };

  // --- Layout ---
  const padding = { top: 24, right: 20, bottom: 40, left: 52 };
  const plotW = width - padding.left - padding.right;
  const plotH = height - padding.top - padding.bottom;

  if (plotW <= 0 || plotH <= 0 || chartData.length === 0) return;

  // --- Clear ---
  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, width, height);

  const maxProb = Math.max(...chartData.map((d) => d.probability), 0.01);
  const maxAttempt = chartData.length;

  // --- Horizontal grid lines ---
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;

  const gridLineCount = 4;
  for (let i = 0; i <= gridLineCount; i++) {
    const y = padding.top + (plotH * i) / gridLineCount;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
  }

  // --- Y-axis labels ---
  ctx.fillStyle = colors.text;
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (let i = 0; i <= gridLineCount; i++) {
    const y = padding.top + (plotH * i) / gridLineCount;
    const label = ((1 - i / gridLineCount) * maxProb * 100).toFixed(1) + '%';
    ctx.fillText(label, padding.left - 8, y);
  }

  const barGap = plotW / maxAttempt;
  const barWidth = Math.max(2, barGap * 0.65);

  // --- Bars ---
  for (const entry of chartData) {
    const x =
      padding.left + (entry.attempt - 1) * barGap + barGap / 2 - barWidth / 2;
    const barHeight = (entry.probability / maxProb) * plotH;
    const y = padding.top + plotH - barHeight;

    ctx.fillStyle = colors.bar;
    ctx.fillRect(x, y, barWidth, barHeight);
  }

  // --- Cumulative line ---
  ctx.strokeStyle = colors.cumulative;
  ctx.lineWidth = 2;
  ctx.beginPath();

  let cumulativeProb = 0;
  for (const entry of chartData) {
    cumulativeProb += entry.probability;
    const cx = padding.left + (entry.attempt - 1) * barGap + barGap / 2;
    const cy = padding.top + plotH - cumulativeProb * plotH;

    if (entry.attempt === 1) {
      ctx.moveTo(cx, cy);
    } else {
      ctx.lineTo(cx, cy);
    }
  }
  ctx.stroke();

  // --- p95 marker (dashed vertical line) ---
  const markerX = padding.left + (p95 - 1) * barGap + barGap / 2;

  ctx.strokeStyle = colors.marker;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 3]);
  ctx.beginPath();
  ctx.moveTo(markerX, padding.top);
  ctx.lineTo(markerX, padding.top + plotH);
  ctx.stroke();
  ctx.setLineDash([]);

  // "95%" label above marker
  ctx.fillStyle = colors.marker;
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText('95%', markerX, padding.top - 2);

  // --- X-axis label ---
  ctx.fillStyle = colors.text;
  ctx.font = '12px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(
    '시도 횟수',
    padding.left + plotW / 2,
    height - padding.bottom + 8
  );

  // --- X-axis tick labels (show every few attempts to avoid clutter) ---
  ctx.font = '10px sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillStyle = colors.text;

  const tickStep = maxAttempt > 30 ? Math.ceil(maxAttempt / 10) : 1;
  for (let attempt = 1; attempt <= maxAttempt; attempt += tickStep) {
    const tx = padding.left + (attempt - 1) * barGap + barGap / 2;
    ctx.fillText(String(attempt), tx, height - padding.bottom + 22);
  }
}
