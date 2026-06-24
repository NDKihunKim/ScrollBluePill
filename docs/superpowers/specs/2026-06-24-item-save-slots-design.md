# Item Card Save Slots

**Date**: 2026-06-24
**Scope**: Both calculator pages (deconstruction.astro, expected-value.astro) + shared module

## Problem

Users cannot save, compare, or return to previous item configurations. Every item switch or reset loses all edits irreversibly.

## Design

### Architecture

**Shared module** `src/lib/itemSlotStore.mjs`:
- 4 slots per page, persisted to `localStorage`
- Key format: `itemSlots:v1:<page>` (versioned for future migration)
- Each slot: `{ itemId, item, savedAt, pageState }`

**Deconstruction pageState**: `{ itemId, deconDeltas, successfulScrollCount, remainingSlots, appliedLevelCount, gemFilter: [...], scrollRateFilter: [...], stimulantBoundsMap, scrollSource, stimulantSource, gemsSource, itemLevelUpSource }`

**Expected-value pageState**: `{ itemId, enhancementState }` (the full enhancement state including gemSlots, scrollSlots, stimulant configs, mode selections, itemLevelUp configs)

### UI Layout

```
aside.panel
  h2: "아이템 미리보기"
  .item-slot-bar (4 slot boxes in a horizontal row)
    .item-slot (×4)
      img (saved item icon, or nothing if empty)
      button.item-slot-x (× clear button, hidden when empty)
  .selected-item-card
    button.item-card-star (★/☆, upper right corner of item card)
    ... existing item card content ...
```

- Empty slots: dotted outline, no icon, no × button
- Filled slots: solid outline with saved item icon, × button top-right
- Star button: `position: absolute; top: 8px; right: 8px;` on the item card. Outline (☆) = not saved. Filled yellow (★) = current config matches a saved slot.

### Flows

**Save flow:**
1. User clicks ★ on item card → always shows the 4-slot picker overlay
2. Each slot renders its saved item icon (or empty with dotted outline labeled "빈 슬롯")
3. User clicks an empty slot → saves directly, overlay closes
4. User clicks a filled slot → replacement confirmation modal showing BOTH item cards side by side (new vs existing). Confirm → overwrites. Cancel → returns to slot picker.

**Load flow:**
1. User clicks a filled slot in the slot bar → loads immediately (no confirmation needed since slots are compact previews, and the item card updates in real-time)
2. `pageState` is deserialized and applied to restore full calculation state
3. Analysis results are cleared

**Delete flow:**
1. User clicks × on a filled slot
2. Confirmation modal shows the saved item card within the warning
3. Confirm → slot cleared. If the deleted slot matched the current config, star reverts to ☆

**Star state:**
- ☆ outline = current config doesn't match any saved slot
- ★ filled yellow = current config exactly matches a saved slot (same item + same edits)
- Checked on every state change (stat edit, slot change, source toggle, item switch)

### Edge Cases

- Item no longer in index on load → error toast, slot shown with "?" icon, clicking offers to clear
- localStorage full → error on save
- Cross-page isolation → deconstruction slots never appear on EV page
- Multiple slots with same config → star shows filled (matches at least one), save picker shows all

### CSS Notes

- `.item-slot-bar`: horizontal flex row, small gap
- `.item-slot`: ~50px square, solid border when filled, dotted border when empty
- `.item-slot-x`: `position: absolute; top: -6px; right: -6px;` small circle ×
- `.item-card-star`: absolute positioned, 24px, yellow when `.item-card-star--saved`
- Replacement modal: reuse `.decon-confirm-overlay` / `.decon-confirm-dialog` pattern with two item cards side by side

### Files

- **Create**: `src/lib/itemSlotStore.mjs` — save/load/delete/slot management
- **Modify**: `src/pages/deconstruction.astro` — integrate slot bar + star button
- **Modify**: `src/pages/expected-value.astro` — integrate slot bar + star button
