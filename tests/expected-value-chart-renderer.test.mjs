import assert from 'node:assert/strict';
import test from 'node:test';

import { renderAttemptChart } from '../src/lib/expectedValue/chartRenderer.mjs';

function createFakeContext() {
  return {
    fillStyle: '',
    font: '',
    lineWidth: 1,
    strokeStyle: '',
    textAlign: '',
    textBaseline: '',
    beginPath() {},
    closePath() {},
    fill() {},
    fillRect() {},
    fillText() {},
    lineTo() {},
    moveTo() {},
    arc() {},
    rotate() {},
    save() {},
    restore() {},
    scale() {},
    setLineDash() {},
    stroke() {},
    translate() {},
  };
}

function createFakeCanvas() {
  const canvas = {
    height: 150,
    parentElement: { clientWidth: 640 },
    style: {},
    width: 300,
    getBoundingClientRect() {
      const width =
        this.style.width === '100%'
          ? this.parentElement.clientWidth
          : Number.parseFloat(this.style.width) || this.width;
      const height = Number.parseFloat(this.style.height) || this.height;
      return { width, height };
    },
    getContext(type) {
      return type === '2d' ? createFakeContext() : null;
    },
  };
  return canvas;
}

test('renderAttemptChart pins display size so repeated renders do not visually zoom canvas', () => {
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  globalThis.window = { devicePixelRatio: 2 };
  globalThis.document = {
    documentElement: {
      getAttribute(name) {
        return name === 'data-theme' ? 'dark' : null;
      },
    },
  };

  try {
    const canvas = createFakeCanvas();
    const chartData = [
      { percentile: 0, attempts: 0 },
      { percentile: 10, attempts: 2 },
      { percentile: 25, attempts: 3 },
      { percentile: 50, attempts: 5 },
      { percentile: 75, attempts: 8 },
      { percentile: 90, attempts: 12 },
      { percentile: 95, attempts: 16 },
      { percentile: 99, attempts: 20 },
    ];

    renderAttemptChart(canvas, chartData);
    const firstBackingSize = { width: canvas.width, height: canvas.height };

    renderAttemptChart(canvas, chartData);
    const secondBackingSize = { width: canvas.width, height: canvas.height };

    assert.equal(canvas.style.width, '100%');
    assert.equal(canvas.style.maxWidth, '100%');
    assert.equal(canvas.style.height, '220px');
    assert.deepEqual(firstBackingSize, { width: 1280, height: 440 });
    assert.deepEqual(secondBackingSize, firstBackingSize);
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
  }
});
