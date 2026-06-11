# Item Card Stat Breakdown Design

## Goal

Update the selected/enhanced item card stat display so enhanced stats show both the final total and a concise breakdown of how that total was produced.

Example for Zakum Helmet after +5 STR from enhancement:

```text
STR : +20 (15+5)
```

The final total remains the primary value. The parenthesized value explains the total as:

```text
original stat + maker total + scroll total
```

Zero contribution groups are omitted from the parenthesized breakdown.

## Requirements

- Show the final total with the existing stat value formatting.
- Show a parenthesized breakdown only when at least one enhancement contribution exists for that stat.
- Treat maker total as maker gems plus stimulant.
- Treat scroll total as normal scrolls plus chaos scrolls.
- Omit zero contribution groups from the breakdown.
- Preserve current hiding behavior for stat rows whose final total is `0` or below.
- Do not apply breakdown formatting to metadata rows such as upgrade slots or attack speed.

## Display Rules

For a stat with original `15`, maker `0`, and scroll `5`:

```text
STR : +20 (15+5)
```

For original `15`, maker `5`, and scroll `5`:

```text
STR : +25 (15+5+5)
```

For original `15`, maker `-3`, and scroll `5`:

```text
STR : +17 (15-3+5)
```

For original `15`, maker `0`, and scroll `0`:

```text
STR : +15
```

## Architecture

Add a helper in `src/lib/enhancementState.mjs` that computes a per-stat breakdown from `baseStats` and the current enhancement state.

The helper should return values grouped by stat key:

```js
{
  str: {
    original: 15,
    maker: 5,
    scroll: 5,
    total: 25,
  },
}
```

This keeps calculation rules in the enhancement-state module instead of duplicating them in the Astro page script.

## Data Flow

1. Enhancement state changes when scrolls, chaos values, maker gems, or stimulant values are applied.
2. `enhancementPanel.mjs` and `makerPanel.mjs` compute:
   - accumulated stats for existing behavior
   - stat breakdown for display detail
3. `renderEnhancedItemCard` receives the breakdown data.
4. The item card renders each visible stat as:
   - final formatted total
   - optional breakdown suffix when maker or scroll contribution is non-zero

## Formatting

The breakdown should use raw signed arithmetic pieces without extra spaces:

```text
(15+5)
(15+5+5)
(15-3+5)
```

The final total keeps the existing stat formatter:

```text
+20
```

## Testing

Add state-level tests for the breakdown helper:

- scroll-only contribution
- maker gem plus stimulant contribution
- combined maker and scroll contribution
- negative contribution formatting support through returned signed values

Add a source contract or focused render test for the item card display path:

- `renderEnhancedItemCard` receives/uses breakdown data
- metadata rows remain excluded

## Out Of Scope

- Redesigning the item card layout.
- Changing stat order.
- Changing grade color calculations.
- Changing enhancement math.
- Showing separate gem and stimulant subparts.
- Showing breakdowns for unenhanced stats.

## Self-Review

- No placeholders or TBDs remain.
- Maker total explicitly includes stimulant.
- Zero contribution groups are explicitly omitted.
- Metadata rows are explicitly excluded.
- The spec is scoped to display formatting and the supporting breakdown data.
