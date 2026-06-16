# Maker Additional Material Mode Design

## Goal

Add a split-mode system to the Maker additional material slots so users can distinguish between stats that already exist on an item and stats whose crafting probability should be included in expected-value calculation.

The feature applies to:

- The Maker stimulant slot.
- The special variable gems `흑수정` and `어둠의 크리스탈`.

## Existing Context

The Maker panel already supports:

- One stimulant slot in `src/lib/makerPanel.mjs`.
- Normal gem slots, including variable stat input for `흑수정` and `어둠의 크리스탈`.
- Manual stat storage in `src/lib/enhancementState.mjs`.
- Expected-value calculation in `src/pages/index.astro` and `src/lib/expectedValue/*`.

The current UI has one action per stimulant or variable gem stat entry. The expected-value path currently needs a clearer distinction between manually guaranteed stats and probability-mode entries.

## User Experience

The `추가 재료` label gains a small circular `?` help affordance. Hovering or focusing it explains the modes:

- `추옵`: enter stats that already exist on the item or gem result. These stats are treated as guaranteed.
- `촉진제`: enter stimulant outcome stats and include stimulant crafting probability in expected-value calculation.
- `확률 적용`: enter special-gem outcome stats and include the gem probability model in expected-value calculation.

The stimulant slot shows a split overlay on hover and keyboard focus:

- Upper half: `추옵`.
- Lower half: `촉진제`.

Both halves open the existing stimulant stat input panel. The selected half only changes how the saved stats are interpreted.

For `흑수정` and `어둠의 크리스탈`, the variable gem slot shows a split overlay on hover and keyboard focus:

- Upper half: `추옵`.
- Lower half: `확률 적용`.

Both halves open the existing variable-gem stat input panel. The selected half only changes how the saved stats are interpreted.

The design should use the same compact slot visual language already present in the Maker section. On touch devices where hover is unavailable, tapping a relevant empty or filled slot should expose the same two choices before opening the stat input panel.

## State Model

Stimulant state gains an explicit mode:

```js
{
  stimulantSlot: null | {
    stats: Record<string, number>,
    mode: 'manual' | 'probability'
  }
}
```

Variable gem slot state gains the same mode when `stats` are manually entered:

```js
{
  gemKey: 'blackAmethyst' | 'darkCrystal',
  stats: Record<string, number>,
  mode: 'manual' | 'probability'
}
```

Existing fixed gem slots continue to use `{ gemKey, gradeIndex }`.

For compatibility with existing state created before this change, a missing `mode` on a manual stat entry is treated as `manual`.

## Calculation Rules

Item preview and stat breakdown always include the entered manual stats, regardless of mode. This lets users see the target item they are describing.

Expected-value calculation interprets modes differently:

- `manual`: pre-apply the entered stats to the clean item baseline and reduce matching target thresholds. Do not count this source as RNG.
- `probability`: do not pre-apply the entered stats as guaranteed stats. Count this source as an RNG source and use the existing stimulant or special-gem probability model.

This prevents double-counting: a probability-mode stimulant or special gem contributes to the item preview as the user's desired outcome, but expected-value calculation treats that outcome as something to be achieved through probability rather than something already guaranteed.

For stimulant probability mode, expected-value calculation keeps the existing stimulant model: 90% success followed by random chaos deltas on applicable stats.

For special-gem probability mode, expected-value calculation keeps the existing random gem models:

- `흑수정`: grade-inferred black amethyst probability table.
- `어둠의 크리스탈`: random chaos-style stat deltas for STR/DEX/INT/LUK.

## UI Implementation Boundaries

`makerPanel.mjs` owns the split slot controls because the interaction belongs to the Maker additional material area.

The implementation should:

- Reuse the existing stimulant and variable-gem input panels.
- Add only enough state to remember the selected mode.
- Keep normal fixed-gem selection behavior unchanged.
- Keep slot clearing behavior unchanged.
- Avoid broad refactors of the Maker panel.

The `?` help affordance belongs next to the static `추가 재료` label in `src/pages/index.astro`. The tooltip can be CSS-only if that matches the surrounding page patterns.

## Testing

Add focused tests before implementation:

- Enhancement state stores `manual` and `probability` modes for stimulant entries.
- Enhancement state stores `manual` and `probability` modes for variable gem entries.
- Missing mode defaults to `manual` for backward compatibility.
- Expected-value strategy construction pre-applies manual stimulant and variable gem stats.
- Expected-value strategy construction leaves probability-mode stimulant and variable gem stats as RNG sources.
- Deterministic strategy detection treats manual entries as deterministic and probability entries as non-deterministic.
- UI source contract verifies the split labels `추옵`, `촉진제`, and `확률 적용`.
- UI source contract verifies the `추가 재료` help affordance and explanatory text.

## Out of Scope

- Changing stimulant or special-gem probability tables.
- Changing normal fixed-gem grade selection.
- Persisting Maker state outside the current calculator session.
- Redesigning the full Maker panel layout.
