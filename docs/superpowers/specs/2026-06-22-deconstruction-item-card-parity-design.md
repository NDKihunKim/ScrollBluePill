# Deconstruction Item Card Parity Design

## Goal

Align the deconstruction page's selected-item card with the established expected-value card for Reverse and Timeless equipment.

## Requirements

- Show `ITEM LEV : 1` and `ITEM EXP : 0 %` for selected items that have a supported Reverse or Timeless level-up definition.
- Place those rows after the standard requirement rows and before the stat rows.
- Render `공격속도` as the first stat row, matching expected-value.
- Refresh the metadata when either the selected item changes or the asynchronously loaded item-level-up definitions become available.
- Preserve all other deconstruction card formatting, delta calculations, and enhancement-source behavior.

## Design

The deconstruction page already loads item-level-up definitions into `itemLevelUpByItemId`. Its card renderer will look up the selected item's definition and use the existing `computeItemLevelUpCardMeta` helper with an empty level-up state. This produces the same initial metadata used by expected-value: item level `1` and item EXP `0 %`.

The renderer will append the metadata only when the helper returns a value. Items without a supported definition will retain the current requirement rows with no item-level metadata.

The existing `deconStatRows` definition will move `attackSpeed` to its first position. The existing attack-speed resolution and formatting logic will remain unchanged.

When item-level-up data finishes loading, the page will refresh the selected item card in addition to updating source eligibility. This handles selections made before the asynchronous definition request completes.

## Testing

Add focused deconstruction UI contract coverage that verifies:

- the page uses `computeItemLevelUpCardMeta` for selected-item metadata;
- `ITEM LEV` and `ITEM EXP` are appended from the computed metadata;
- the card refreshes after item-level-up definitions load;
- `attackSpeed` is the first deconstruction stat-row entry.

Run the focused contract test, the complete deconstruction test set, and the production build.

## Out of Scope

- Extracting a shared item-card renderer.
- Changing item-level-up calculations or definitions.
- Displaying simulated future item levels from deconstruction result strategies.
- Reformatting unrelated requirement or stat rows.

## Self-Review

- The behavior is limited to Reverse and Timeless items represented by supported definitions.
- Async loading behavior is explicit.
- Stat ordering matches the approved visual reference.
- No unrelated card or analysis behavior is changed.
