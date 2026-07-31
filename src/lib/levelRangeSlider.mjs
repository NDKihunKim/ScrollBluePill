/**
 * Wire up an existing dual-range slider for the level-range filter.
 * The slider HTML (span.dual-range with two input[type=range] children)
 * must already be present in the DOM between the min and max number inputs.
 *
 * Two-way sync: dragging a slider thumb updates the number input;
 * typing in a number input updates the slider thumb.
 *
 * @param {HTMLElement} container — the .level-range-control element
 */
export function initLevelRangeSlider(container) {
  if (!(container instanceof HTMLElement)) return;

  const minInput = container.querySelector('[data-level-min-input]');
  const maxInput = container.querySelector('[data-level-max-input]');
  const sliderWrap = container.querySelector('.dual-range');
  if (
    !(minInput instanceof HTMLInputElement) ||
    !(maxInput instanceof HTMLInputElement) ||
    !(sliderWrap instanceof HTMLElement)
  )
    return;

  const sliders = sliderWrap.querySelectorAll('input[type=range]');
  const minSlider = sliders[0];
  const maxSlider = sliders[1];
  if (!(minSlider instanceof HTMLInputElement) || !(maxSlider instanceof HTMLInputElement))
    return;

  // Override CSS vars for taller container so thumbs have clearance
  sliderWrap.style.setProperty('--dh', '28px');
  sliderWrap.style.setProperty('--th', '4px');

  // Sync slider positions to match the current input values.
  // Does NOT overwrite the inputs — lets the user type freely.
  const syncSliders = () => {
    let lo = Number(minInput.value);
    let hi = Number(maxInput.value);
    if (!Number.isFinite(lo)) lo = 0;
    if (!Number.isFinite(hi)) hi = 200;
    lo = Math.max(0, Math.min(200, lo));
    hi = Math.max(0, Math.min(200, hi));
    minSlider.value = lo;
    maxSlider.value = hi;
  };

  // Slider → input (drag updates the number input immediately)
  minSlider.addEventListener('input', () => {
    let v = Number(minSlider.value);
    if (v > Number(maxSlider.value)) maxSlider.value = v;
    minInput.value = v;
    minInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  maxSlider.addEventListener('input', () => {
    let v = Number(maxSlider.value);
    if (v < Number(minSlider.value)) minSlider.value = v;
    maxInput.value = v;
    maxInput.dispatchEvent(new Event('input', { bubbles: true }));
  });

  // Input → slider: update slider position as the user types
  container.addEventListener('input', (e) => {
    if (e.target === minInput || e.target === maxInput) syncSliders();
  });

  syncSliders();
}
