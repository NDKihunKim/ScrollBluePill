# OCR Preprocessing Viewer — Design

Date: 2026-08-12

## Goal

Judge the OCR preprocessing visually. In `astro dev`, pasting an item screenshot shows the original and the high-contrast black-on-white preprocessed image side by side, with the raw OCR text and confidence — so the user can eyeball preprocessing quality before iterating on the algorithm.

## Context

- OCR is client-side tesseract.js (kor+eng), wired in `src/lib/imageStatParser.mjs`.
- Uncommitted work already adds `preprocessImage` (grayscale → Otsu threshold → invert to black-on-white), used inside `ocrImage`; its output is invisible today.
- Screenshot flow: paste → `processScreenshot` (`src/pages/deconstruction.astro:775`) → `parseScreenshot` → confidence/item-match guards → stats applied.

## Changes

### 1. `src/lib/imageStatParser.mjs`

- `export async function preprocessImage(blob)` (currently module-private).
- `parseScreenshot` also returns `text` (raw OCR) alongside `{ itemName, stats, confidence, enhancementLevel, remainingSlots }`, so the preview shows exactly the text production parsed. One OCR run, one code path.

### 2. `src/pages/deconstruction.astro`

- Markup: after the screenshot feedback `<p>` (line 66), a hidden debug panel — two `<img>`s (original, preprocessed) plus a `<pre>` (raw OCR text + confidence). Gated with `{import.meta.env.DEV && ...}` so it is stripped from production builds (same mechanism as `src/lib/debug.mjs`).
- Script: inside `doProcess`, a DEV-guarded block builds object URLs from `blob` and from `preprocessImage(blob)` output, fills the panel, and unhides it. Object URLs are not revoked (dev-only; `ponytail:` comment).
- CSS: ~8 lines, side-by-side images with max-width.

## Non-goals

- No changes to the preprocessing algorithm itself — this is the viewer; algorithm iteration happens after the user judges the current output.
- No production-visible UI.
- No test: no new logic beyond DOM wiring (YAGNI applies to tests too).

## Verification

- `npm run dev`: paste a messy screenshot → panel shows original vs black-on-white image plus OCR text/confidence.
- `npm run build`: panel absent from production output (DEV-gated).
