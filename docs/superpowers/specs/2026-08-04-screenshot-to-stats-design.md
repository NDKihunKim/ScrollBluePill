# Screenshot-to-Stats: Image Upload for Deconstruction Stat Editor

**Date:** 2026-08-04
**Status:** approved

## Overview

Add an image upload button (📷) inside the item search input row on the deconstruction page. Users can paste an image from clipboard (Ctrl+V when search input is focused) or select a file from disk. The screenshot is parsed via client-side OCR (Tesseract.js) to identify the MapleStory item and auto-fill its stats into the stat editor panel.

## Architecture

Two net-new files + minimal inline additions to the page script:

- **`src/lib/imageStatParser.mjs`** (~80 lines) — stateless functions: lazy-init Tesseract worker with `kor+eng` language, run OCR on an image blob, regex-parse item name and stat key/value pairs from raw text
- **Inline additions to `deconstruction.astro`** (~50 lines) — camera button DOM, paste event handler, file picker wiring, orchestration logic that calls the parser and feeds results into existing `commitSuggestedItem` / `setStatDelta` functions
- **New dependency:** `tesseract.js@5` — client-side OCR. The heavy assets (Web Worker `.js`, `.wasm`, Korean `traineddata`) are loaded dynamically from jsdelivr CDN on first use, then cached by the browser. Does not affect Cloudflare Pages deployment.

## Data Flow

```
1. Trigger
   ├─ Ctrl+V on search input  →  paste event → image Blob
   └─ Click 📷 button         →  hidden <input type="file"> → image Blob

2. OCR (Tesseract.js, kor+eng)
   → raw text string with confidence scores

3. Regex Parse
   → { itemName: string, stats: { str?: number, dex?: number, ... } }

4. Item Name Match (searchKoreanItems)
   ├─ NO match  → inline error: "아이템을 식별할 수 없습니다. 다시 시도해주세요."
   └─ MATCH     → proceed

5. Fill
   ├─ Select item via commitSuggestedItem()
   └─ Set deconDeltas from parsed stats, rebuild stat editor
```

## UI States

| State | Input Appearance | Feedback |
|-------|-----------------|----------|
| Default | Normal input + 📷 button, placeholder mentions Ctrl+V | — |
| Processing | Input disabled, spinner icon, blue border | "스크린샷을 분석하고 있습니다…" |
| Success | Item name filled, green border, ✕ clear button | "아이템 식별 완료 — 스탯이 편집기에 반영되었습니다" |
| Error (no match) | Input cleared, red border, ↻ retry button | "아이템을 식별할 수 없습니다. 더 선명한 스크린샷으로 다시 시도해주세요." |
| Error (too blurry) | Input cleared, red border | "이미지가 너무 흐립니다. 더 선명한 스크린샷을 사용해주세요." |
| Error (network) | Input restored | "분석 엔진을 불러올 수 없습니다. 인터넷 연결을 확인해주세요." |

## Error Handling

- **No file selected** → no-op
- **Tesseract confidence below threshold** → show blur error, stop
- **Item name not found in index** → show no-match error, stop (do not touch stat editor)
- **Item found but no stats parsed** → still select item, skip stat filling
- **Tesseract worker fails to load (CDN/network)** → show network error
- **Existing dirty state (hasDeconDraftState)** → reuse existing `guardDeconMutation` confirmation dialog before replacing

## Edge Cases

- **Second screenshot while one is active** → replace, don't append
- **Manual edits before upload** → `guardDeconMutation` prompts confirmation, then replace
- **Screenshot of different item than currently selected** → triggers existing item-change dialog
- **Empty clipboard (no image data)** → no-op
- **Non-image file pasted** → no-op

## What We're NOT Building (YAGNI)

- No image cropping or region selection
- No drag-and-drop
- No history of uploaded screenshots
- No manual correction UI for individual parsed stats
- No server-side processing — everything is client-side

## Regex Stat Patterns

MapleStory item tooltips follow consistent patterns. The OCR output is matched against:

Korean: `공격력`, `마력`, `STR`, `DEX`, `INT`, `LUK`, `최대HP`, `최대MP`, `물리방어력`, `마법방어력`, `명중률`, `회피율`, `이동속도`, `점프력`

Each line is expected to follow: `LABEL : +N` or `LABEL+N` or `LABEL : +N%` (for boss damage, etc.)

The parser extracts the numeric value and maps the label to the internal stat key.

## Implementation Notes

- Parse confidence: use Tesseract's word-level confidence. If average confidence < 50%, treat as blurry.
- Item name matching: score against item index using existing `searchKoreanItems`. If best score < 70 (prefix threshold), treat as no match.
- Stats are set as `deconDeltas` (overrides), not base stats — consistent with how the editor works.
- Camera button is a `<button type="button">` that triggers a hidden `<input type="file" accept="image/*">`.
