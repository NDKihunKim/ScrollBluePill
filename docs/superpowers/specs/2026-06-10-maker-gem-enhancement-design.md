# Maker Gem Enhancement — Design Spec

**Date:** 2026-06-10
**Status:** Approved

## Overview

Add a "메이커" (Maker) gem enhancement feature to the ScrollBluePill MapleStory scroll calculator. Maker allows players to enhance crafted equipment with gems (보석 강화) in independent gem slots separate from scroll upgrade slots.

## Gem Data Model

File: `src/lib/makerData.mjs`

### Gem Types (12 total, 2 weapon-only)

Sorted by stat priority (see Stat Priority below).

| Key | Name (KO) | Stat | Weapon Only | 하급 | 중급 | 상급 |
|-----|-----------|------|-------------|------|------|------|
| `diamond` | 다이아몬드 | weaponAttack | Yes | +1 | +2 | +3 |
| `sapphire` | 사파이어 | magicAttack | Yes | +1 | +2 | +3 |
| `strCrystal` | 힘의 크리스탈 | str | No | +1 | +3 | +5 |
| `dexCrystal` | 민첩의 크리스탈 | dex | No | +1 | +3 | +5 |
| `intCrystal` | 지혜의 크리스탈 | int | No | +1 | +3 | +5 |
| `lukCrystal` | 행운의 크리스탈 | luk | No | +1 | +3 | +5 |
| `garnet` | 가넷 | accuracy | No | +2 | +3 | +5 |
| `opal` | 오팔 | avoidability | No | +2 | +3 | +5 |
| `amethyst` | 자수정 | speed | No | +2 | +3 | +5 |
| `aquamarine` | 아쿠아마린 | jump | No | +1 | +3 | +5 |
| `topaz` | 토파즈 | maxHp | No | +10 | +20 | +30 |
| `emerald` | 에메랄드 | maxMp | No | +10 | +20 | +30 |

### Gem Grades

Three grades per gem type: `하급` (low), `중급` (mid), `상급` (high). Grade picker displays in reverse order: 상급 > 중급 > 하급.

### Duplicate Prevention

The same gem type (`key`) cannot be selected in more than one gem slot. If a gem type is already assigned to a slot, it is grayed out and unclickable in the step 1 picker.

## Stat Priority (Extended)

The existing `STAT_KEY_RANK` from scroll sort is extended to cover all gem stats:

| Priority | Stat Key | Korean Label |
|----------|----------|--------------|
| 0 | `weaponAttack` | 공격력 |
| 1 | `magicAttack` | 마력 |
| 2 | `str` | STR |
| 3 | `dex` | DEX |
| 4 | `int` | INT |
| 5 | `luk` | LUK |
| 6 | `accuracy` | 명중률 |
| 7 | `avoidability` | 회피율 |
| 8 | `speed` | 이동속도 |
| 9 | `jump` | 점프력 |
| 10 | `maxHp` | MaxHP |
| 11 | `maxMp` | MaxMP |

Gem types in step 1 picker are sorted by this ranking.

## Gem Slot Count by Item Level

| Item `requiredLevel` | Gem Slots |
|----------------------|-----------|
| < 48 | 0 (Maker disabled) |
| 48–77 | 1 |
| 78–105 | 2 |
| 106+ | 3 |

## Enhancement State (`src/lib/enhancementState.mjs`)

A wrapper around the existing `scrollState` that adds gem slot management.

### Structure

```
enhancementState
├── scrollState (existing: slots[], currentSlot, slotCount)
├── gemSlots[]     — Array of { gemKey, gradeIndex } | null
├── gemSlotCount   — 0–3 based on item requiredLevel
└── makerActive    — boolean
```

### API

| Function | Purpose |
|----------|---------|
| `createEnhancementState(upgradeSlots, itemLevel)` | Create combined state, auto-compute gemSlotCount |
| `activateMaker(state)` | Toggle Maker on, render gem slots |
| `deactivateMaker(state)` | Toggle Maker off, clear all gem slots |
| `applyGem(state, slotIndex, gemKey, gradeIndex)` | Place gem into slot, validates no duplicate gemKey |
| `revertGemSlot(state, slotIndex)` | Clear one gem slot |
| `resetGems(state)` | Clear all gem slots |
| `computeAccumulatedStats(baseStats, state)` | Sum base + scrollSlots + gemSlots |
| `computeGradeColor(state)` | Includes gem contributions in grade calculation |
| `isGemSlotAvailable(state, gemKey)` | Check if gemKey already used in another slot |

### Scroll delegation

Existing scroll helpers (`applyScroll`, `revertToSlot`, `computeRemainingSlots`, etc.) are re-exported and delegate to the inner `scrollState` transparently. No consumer code needs to know about the nesting.

## UI Layout

Located in Panel 2 (enhancement panel), below the scroll list (`<div class="scroll-list">`).

### Maker Toggle Button

- Always visible in panel 2
- **Disabled** (grayed out) when item `requiredLevel < 48`
- **Enabled** when `requiredLevel >= 48` — clicking toggles Maker on/off
- When Maker is active, button shows active/highlighted state

### Gem Slot Row

Label: **"추가 재료"**

Three gem slot boxes, rendered horizontally:
- Active slots: show gem icon, name, and grade label (e.g., "힘의 크리스탈", "상급")
- Disabled slots (index >= gemSlotCount): show ✗ overlay, not clickable
- Empty active slots: show placeholder, clickable

Clicking a filled slot clears it (revert) or reopens the picker to change the gem.

### Step 1 Picker: 보석 종류 선택

Appears when an empty gem slot is clicked. Grid of gem type boxes, each containing:
- Icon (from MapleStory.io CDN using gem item ID)
- Gem name in Korean
- Stat label in parentheses (e.g., "(STR)")

Filtering:
- Weapon-only gems (다이아몬드, 사파이어) hidden for non-weapon equipment (weapon detection reuses the existing weapon kind list from `src/lib/maplestoryIo.mjs`)
- Already-used gem types grayed out and unclickable

Sorted by extended STAT_KEY_RANK.

### Step 2 Picker: 등급 선택

Appears after a gem type is selected. Shows the gem type name as a header. Three grade boxes in order: 상급 > 중급 > 하급. Each box contains:
- Icon for that specific grade's item
- Grade label
- Stat increment (e.g., "STR +5")

### Icon Strategy

Icons loaded from MapleStory.io CDN using the same pattern as existing item icons:
```
https://maplestory.io/api/global/87/item/{itemId}/icon
```

Each gem type has a representative item ID (중급 version). Each grade level also has distinct item IDs for the step 2 picker. If no icon is available, fallback to a CSS-styled placeholder with stat abbreviation.

## File Changes

| File | Action | Purpose |
|------|--------|---------|
| `src/lib/makerData.mjs` | **New** | Gem definitions, stat priority ranking |
| `src/lib/enhancementState.mjs` | **New** | Wrapper around scrollState with gem slot management |
| `src/lib/makerPanel.mjs` | **New** | Maker UI rendering (gem slots, step 1/2 pickers) |
| `src/lib/enhancementPanel.mjs` | **Modify** | Init makerPanel, integrate into panel lifecycle |
| `src/pages/index.astro` | **Modify** | Add Maker HTML container below scroll-list div |
| `src/lib/scrollState.mjs` | **Modify** | Export STAT_KEY_RANK for external extension |

## Interactions & Edge Cases

### Switching items
When user selects a new item, the entire enhancement state is recreated with the new item's `upgradeSlots` and `requiredLevel`. Gem slots are cleared.

### Maker disable mid-use
If Maker is toggled off with gems applied, all gems are cleared and the gem section collapses. Toggling back on shows empty slots.

### Reset
The "초기화" (reset) button clears both scroll slots and gem slots.

### Grade color
Gem stat contributions count toward grade color thresholds alongside scroll contributions. HP/MP gems follow the existing 10:1 weighting for grade color calculation.

### No scrolls applied
Maker works independently — gems can be applied even if zero scrolls have been used.
