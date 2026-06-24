# Deconstruction Stat Editor — Group Headers & Label Alignment

**Date**: 2026-06-24
**Scope**: `src/pages/deconstruction.astro` — Section 2 (스탯 편집) stat editor area

## Problem

1. All stat rows in the deconstruction stat editor are rendered flat with no visual grouping, making it hard to distinguish base stats from item metadata.
2. Label widths vary per row (`min-width: 80px`), so longer labels like "주문서 성공 횟수" push their stepper controls to the right, breaking vertical alignment across rows.

## Design

### Grouping

Two visual groups separated by sub-titles and separator lines:

```
[sub-title] 기본 스탯
  dynamic stat rows (deconStatEditor)
[separator line]

[sub-title] 아이템 정보
  주문서 성공 횟수 (decon-success-row)
  남은 슬롯 (decon-slot-row)
  아이템 레벨 (decon-level-row, conditional)
[separator line]

[+] + 스탯 추가 (unchanged, outside groups)
```

- "아이템 정보" sub-title and the "기본 스탯" separator start hidden, revealed when an item is selected.
- The "기본 스탯" separator is appended dynamically as the last child of `decon-stat-editor` after all stat rows.
- When `decon-level-row` is hidden (item doesn't support level-ups), measurement and separator placement ignore it.

### Sub-title style

- Bold, ~0.82rem, `var(--muted)` color, 2px bottom margin
- A dedicated class (e.g. `.decon-stat-group-title`)

### Separator style

- 1px solid `var(--line)`, full width, 8px vertical margin
- A dedicated class (e.g. `.decon-stat-group-sep`)

### Label alignment (Approach C: per-group column)

Two independent measurement scopes, each setting all labels in its group to the max measured width:

1. **기본 스탯**: all `.chaos-stat-label` inside `decon-stat-editor`
2. **아이템 정보**: the label spans in `decon-success-row`, `decon-slot-row`, `decon-level-row`

Measurement uses `getBoundingClientRect().width` to capture actual rendered width. A function `equalizeGroupLabels(container, labelSelector)` measures all matching labels, finds the max, and sets each label's `style.minWidth` to that value.

Called at:
- End of `rebuildStatEditor()` — for the dynamic rows
- End of `renderDeconSlotState()` and `renderDeconItemLevel()` — for the fixed rows
- After `activateDeconEditPanel()` finishes initial setup

### Edge cases

- **No stats on item**: "기본 스탯" sub-title still renders; separator still renders even if editor is empty.
- **아이템 레벨 hidden**: excluded from "아이템 정보" label measurement and doesn't affect the separator position.
- **Stat added/removed**: `rebuildStatEditor` re-runs measurement.
- **Slot counts changed**: `renderDeconSlotState` re-runs fixed-row measurement.

## Implementation Notes

- Changes confined to `src/pages/deconstruction.astro`:
  - HTML template: static sub-titles and separators in `data-decon-edit-content`
  - CSS: new classes for sub-title and separator
  - JS: `equalizeGroupLabels` utility + calls at the appropriate lifecycle points
- No data flow changes, no new files.
