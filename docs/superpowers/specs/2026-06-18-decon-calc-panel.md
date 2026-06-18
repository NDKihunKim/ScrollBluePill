# Deconstruction Calculator — 3. 계산 Panel

**Date:** 2026-06-18
**Status:** design

## Summary

Add a new "3. 계산" panel between "2. 스탯 편집" and the current "3. 해체 결과" (renumbered to "4. 해체 결과"). The panel has target stat checkboxes (like expected-value's target selection) and the 분석 시작 button.

## Panel layout

```
1. 아이템 검색
2. 스탯 편집
3. 계산          ← NEW
4. 해체 결과     ← was 3. 해체 결과
```

## Panel 3: 계산

### Checkbox rules

| Stat type | Visible when | Default checked |
|-----------|-------------|-----------------|
| Core (STR/DEX/INT/LUK/weaponAttack/magicAttack) | On base item OR delta ≠ 0 | Always |
| Non-core | Delta ≠ 0 | Unchecked |

### Behavior
- Checkboxes update live as deltas change in panel 2
- 분석 시작 button enables when ≥1 stat checked
- 분석 시작 runs deconstruction using only checked stats as target conditions
- 분석 시작 button moves from panel 2 to panel 3
- No trial count input (deconstruction uses exact enumeration, not Monte Carlo)

### Styling
- Uses same chip checkbox pattern as expected-value's target selection (`ev-target-chip-grid`, `ev-target-chip`, etc.)
