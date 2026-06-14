import { createSeededRng } from './monteCarloEngine.mjs';

let cancelRequested = false;

self.onmessage = function (event) {
  const msg = event.data;

  if (msg.type === 'cancel') {
    cancelRequested = true;
    return;
  }

  if (msg.type !== 'start') return;

  cancelRequested = false;
  const { trialCount, seed, trialFunctionCode } = msg;

  // The trial function is sent as a string and eval'd in worker context
  let simulateOneTrial;
  try {
    simulateOneTrial = eval(`(${trialFunctionCode})`);
  } catch (e) {
    self.postMessage({ type: 'error', message: `Failed to parse trial function: ${e.message}` });
    return;
  }

  const rng = createSeededRng(seed);
  let successCount = 0;
  const progressInterval = Math.max(1, Math.floor(trialCount / 100));
  let lastProgressTime = performance.now();

  for (let i = 0; i < trialCount; i++) {
    if (cancelRequested) {
      self.postMessage({ type: 'cancelled', trialsCompleted: i });
      return;
    }

    try {
      if (simulateOneTrial(rng)) successCount++;
    } catch (e) {
      self.postMessage({ type: 'error', message: `Trial ${i} error: ${e.message}` });
      return;
    }

    // Throttled progress: every 1% AND roughly every 250ms
    const now = performance.now();
    if (i > 0 && i % progressInterval === 0 && now - lastProgressTime >= 250) {
      lastProgressTime = now;
      self.postMessage({
        type: 'progress',
        trialsCompleted: i + 1,
        totalTrials: trialCount,
        successCount,
        progress: (i + 1) / trialCount,
      });
    }
  }

  self.postMessage({
    type: 'complete',
    successCount,
    totalTrials: trialCount,
    isZeroSuccess: successCount === 0,
  });
};
