# Maker Editor Layout Design

## Goal

Separate the stimulant editor from the gem editor while keeping both within the existing Maker panel.

## Scope

- Show the stimulant slot area whenever Maker is open.
- Show the gem slot area whenever Maker is open.
- Keep both editors collapsed when Maker first opens.
- Render the stimulant editor directly below the stimulant slot after that slot is activated.
- Render the gem editor directly below the gem slots after a gem slot is activated.
- Allow both editors to remain visible at the same time.
- Preserve all existing stimulant and gem calculations, values, apply behavior, and clear behavior.

The pending Chaos Scroll help tooltip is explicitly excluded from this change.

## Structure

Add a dedicated stimulant editor container inside `maker-stimulant-area`, immediately after the stimulant slot container. The existing `maker-picker` remains inside `maker-gem-area` and becomes gem-only.

`initEnhancementPanel` will locate the new stimulant editor elements and pass them into `initMakerPanel`. The Maker panel will render stimulant controls only into the stimulant editor and gem controls only into the existing gem picker.

## Interaction

- Opening Maker reveals both slot areas but does not automatically select the first empty gem slot.
- Clicking or keyboard-activating the stimulant slot opens the stimulant editor beneath that slot.
- Clicking or keyboard-activating an enabled gem slot opens the gem editor beneath the gem slots.
- Opening one editor does not hide or reset the other editor.
- Applying stimulant values closes only the stimulant editor.
- Applying a gem follows the existing next-empty-slot behavior inside the gem editor.
- Clearing the stimulant slot clears its applied state and closes only the stimulant editor.
- Closing or resetting the overall Maker panel closes both editors through their separate hide paths.

## Accessibility

Keep the existing keyboard activation for stimulant and gem slots. Both editor containers use the existing labeled controls and help tooltip semantics; no new interaction mode is introduced.

## Verification

- Add source-contract coverage proving the dedicated stimulant editor exists beneath the stimulant slot.
- Add Maker panel behavior coverage proving Maker opens with both editors hidden.
- Verify stimulant activation opens only the stimulant editor.
- Verify gem activation opens only the gem editor and does not close the stimulant editor.
- Run the full test suite and production build.
- Verify the layout in a desktop and mobile browser viewport.
