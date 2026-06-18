# Maker Editor Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give stimulant and gem editing separate, independently visible surfaces inside the existing Maker panel.

**Architecture:** Add a dedicated stimulant editor container beneath the stimulant slot and keep the existing `maker-picker` gem-only. Pass both surfaces into `initMakerPanel`, split their hide/render paths, and stop automatically opening the first empty gem editor when Maker is enabled.

**Tech Stack:** Astro, browser DOM APIs, Node.js test runner, CSS

---

### Task 1: Add the dedicated stimulant editor surface

**Files:**
- Modify: `src/pages/index.astro:235-250`
- Modify: `src/lib/enhancementPanel.mjs:21-47`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Write the failing source-contract test**

Add this test to `tests/calculator-input-contract.test.mjs`:

```js
test('Maker renders separate stimulant and gem editor surfaces', async () => {
	const enhancementPanelSource = await readFile(new URL('../src/lib/enhancementPanel.mjs', import.meta.url), 'utf8');

	const stimulantSlotIndex = indexSource.indexOf('data-maker-stimulant-slot');
	const stimulantEditorIndex = indexSource.indexOf('data-maker-stimulant-editor');
	const gemSlotsIndex = indexSource.indexOf('data-maker-gem-slots');
	const gemEditorIndex = indexSource.indexOf('data-maker-picker');

	assert.ok(stimulantSlotIndex >= 0);
	assert.ok(stimulantEditorIndex > stimulantSlotIndex);
	assert.ok(gemSlotsIndex > stimulantEditorIndex);
	assert.ok(gemEditorIndex > gemSlotsIndex);
	assert.match(indexSource, /data-maker-stimulant-editor hidden/);
	assert.match(indexSource, /data-maker-picker hidden/);
	assert.match(enhancementPanelSource, /const makerStimulantEditor = enhancementPanel\?\.querySelector\('\[data-maker-stimulant-editor\]'\)/);
	assert.match(enhancementPanelSource, /makerStimulantEditor,/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: FAIL because `data-maker-stimulant-editor` and `makerStimulantEditor` do not exist.

- [ ] **Step 3: Add the stimulant editor markup**

In `src/pages/index.astro`, place this immediately after the stimulant slot container:

```astro
<div class="maker-stimulant-editor" data-maker-stimulant-editor hidden>
	<p class="enhancement-section-label" data-maker-stimulant-editor-label>촉진제 스탯 입력</p>
	<div class="maker-stimulant-editor-grid" data-maker-stimulant-editor-grid></div>
</div>
```

Keep the existing `maker-picker` under `maker-gem-area` unchanged so it remains the gem editor.

- [ ] **Step 4: Pass the new surface into the Maker controller**

In `src/lib/enhancementPanel.mjs`, query and pass the new elements:

```js
const makerStimulantEditor = enhancementPanel?.querySelector('[data-maker-stimulant-editor]');
const makerStimulantEditorLabel = enhancementPanel?.querySelector('[data-maker-stimulant-editor-label]');
const makerStimulantEditorGrid = enhancementPanel?.querySelector('[data-maker-stimulant-editor-grid]');
```

Add them to the `initMakerPanel` argument:

```js
makerStimulantEditor,
makerStimulantEditorLabel,
makerStimulantEditorGrid,
```

- [ ] **Step 5: Run the focused test and verify GREEN**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit the structural change**

Because `src/pages/index.astro` already contains unrelated working-tree changes, stage only this task's hunks:

```bash
git add -p src/pages/index.astro
git add src/lib/enhancementPanel.mjs tests/calculator-input-contract.test.mjs
git commit -m "refactor: separate Maker editor surfaces"
```

### Task 2: Split stimulant and gem editor state

**Files:**
- Modify: `src/lib/makerPanel.mjs:23-57`
- Modify: `src/lib/makerPanel.mjs:274-421`
- Modify: `src/lib/makerPanel.mjs:830-940`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Write the failing independent-editor contract**

Add this test to `tests/calculator-input-contract.test.mjs`:

```js
test('Maker stimulant and gem editors have independent visibility', async () => {
	const makerPanelSource = await readFile(new URL('../src/lib/makerPanel.mjs', import.meta.url), 'utf8');
	const stimulantStart = makerPanelSource.indexOf('const renderStimulantInputPanel');
	const stimulantEnd = makerPanelSource.indexOf('\n\n  const renderStimulantSlot', stimulantStart);
	const stimulantSource = makerPanelSource.slice(stimulantStart, stimulantEnd);
	const enableStart = makerPanelSource.indexOf('const enableMaker');
	const enableEnd = makerPanelSource.indexOf('\n\n    makerToggle.addEventListener', enableStart);
	const enableSource = makerPanelSource.slice(enableStart, enableEnd);

	assert.match(makerPanelSource, /const hideStimulantEditor = \(\) =>/);
	assert.match(makerPanelSource, /makerStimulantEditor\.hidden = true/);
	assert.match(makerPanelSource, /makerStimulantEditor\.hidden = false/);
	assert.match(makerPanelSource, /makerPicker\.hidden = true/);
	assert.doesNotMatch(stimulantSource, /makerPicker/);
	assert.doesNotMatch(enableSource, /renderStep1Picker\(\)/);
	assert.match(makerPanelSource, /hideStimulantEditor\(\);[\s\S]*hidePicker\(\);/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: FAIL because stimulant rendering still targets `makerPicker` and Maker auto-opens the gem editor.

- [ ] **Step 3: Accept the stimulant editor elements**

Extend `initMakerPanel` parameters in `src/lib/makerPanel.mjs`:

```js
makerStimulantEditor,
makerStimulantEditorLabel,
makerStimulantEditorGrid,
```

Add a dedicated hide function without changing the existing gem `hidePicker` behavior:

```js
const hideStimulantEditor = () => {
  if (makerStimulantEditor instanceof HTMLElement) {
    makerStimulantEditor.hidden = true;
  }
  if (makerStimulantEditorGrid instanceof HTMLElement) {
    makerStimulantEditorGrid.replaceChildren();
  }
};
```

- [ ] **Step 4: Render stimulant controls only into the stimulant editor**

Change `renderStimulantInputPanel` guards and targets to use the dedicated elements:

```js
if (!(makerStimulantEditor instanceof HTMLElement) ||
    !(makerStimulantEditorGrid instanceof HTMLElement) ||
    !(makerStimulantEditorLabel instanceof HTMLElement) ||
    !enhancementState) {
  return;
}

makerStimulantEditorLabel.textContent = '촉진제 스탯 입력';
makerStimulantEditorGrid.replaceChildren();
makerStimulantEditorGrid.classList.add('maker-stimulant-input-panel');
makerStimulantEditor.hidden = false;
```

Within that function, replace every `makerPickerGrid.append(...)` call with:

```js
makerStimulantEditorGrid.append(...);
```

In the stimulant Apply handler, replace `hidePicker()` with:

```js
hideStimulantEditor();
```

In the stimulant clear handler, make the same replacement. Do not call `hidePicker()` from stimulant activation, apply, or clear paths.

- [ ] **Step 5: Keep both editors collapsed when Maker opens**

In `enableMaker`, remove the first-empty-slot selection and `renderStep1Picker()` block. Replace it with:

```js
editingSlotIndex = -1;
hidePicker();
hideStimulantEditor();
renderStimulantSlot();
renderGemSlots();
```

Continue revealing both `makerGemArea` and `maker-stimulant-area`. This keeps their slot rows expanded while both editors begin collapsed.

In `disableMaker`, both branches of `activate`, `deactivate`, and `resetMakerUI`, call both hide functions:

```js
hideStimulantEditor();
hidePicker();
```

Do not call one hide function when opening the other editor. This preserves simultaneous visibility.

- [ ] **Step 6: Run the focused tests and verify GREEN**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit the independent state change**

```bash
git add src/lib/makerPanel.mjs tests/calculator-input-contract.test.mjs
git commit -m "feat: split Maker editor state"
```

### Task 3: Style and verify the independent layout

**Files:**
- Modify: `src/pages/index.astro:2387-2670`
- Test: `tests/calculator-input-contract.test.mjs`

- [ ] **Step 1: Add a failing layout contract**

Add this test to `tests/calculator-input-contract.test.mjs`:

```js
test('stimulant editor stays beneath its slot inside the Maker panel', () => {
	assert.match(indexSource, /:global\(\.maker-stimulant-editor\)\s*\{[^}]*margin-top:\s*10px;/s);
	assert.match(indexSource, /:global\(\.maker-stimulant-editor\[hidden\]\)\s*\{[^}]*display:\s*none;/s);
	assert.match(indexSource, /:global\(\.maker-stimulant-editor-grid\)\s*\{[^}]*display:\s*flex;[^}]*flex-direction:\s*column;/s);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/calculator-input-contract.test.mjs
```

Expected: FAIL because the dedicated stimulant editor styles do not exist.

- [ ] **Step 3: Add minimal layout styles**

Add these styles near the existing Maker stimulant styles in `src/pages/index.astro`:

```css
:global(.maker-stimulant-editor) {
	margin-top: 10px;
	padding-top: 10px;
	border-top: 1px solid var(--line);
}

:global(.maker-stimulant-editor[hidden]) {
	display: none;
}

:global(.maker-stimulant-editor-grid) {
	display: flex;
	flex-direction: column;
	gap: 8px;
}
```

Reuse the existing `.chaos-stat-row`, `.chaos-stepper-btn`, `.maker-mode-toggle-row`, and help-tooltip styles. Do not duplicate their declarations.

- [ ] **Step 4: Run all automated verification**

Run:

```bash
node --test tests/*.test.mjs
npm run build
git diff --check
```

Expected: all tests pass, the Astro production build completes, and the diff check emits no output.

- [ ] **Step 5: Verify desktop and mobile behavior in the browser**

Start the local app:

```bash
npm run dev -- --host 127.0.0.1 --port 4321
```

Verify at desktop and mobile widths:

1. Open Maker and confirm stimulant and gem slots are visible while both editors are hidden.
2. Activate the stimulant slot and confirm its editor appears directly underneath it.
3. Activate a gem slot and confirm its editor appears beneath the gem slots without hiding the stimulant editor.
4. Confirm no controls overlap or overflow the Maker panel.
5. Apply stimulant values and confirm only the stimulant editor closes.

- [ ] **Step 6: Review the final diff**

Run:

```bash
git status --short
git diff -- src/pages/index.astro src/lib/enhancementPanel.mjs src/lib/makerPanel.mjs tests/calculator-input-contract.test.mjs
```

Expected: only the dedicated stimulant surface, independent Maker editor logic, focused styles, and their tests are added. Existing unrelated working-tree changes remain preserved.

- [ ] **Step 7: Commit the verified layout styles**

Stage only the new Maker layout CSS hunk from the already-modified Astro page:

```bash
git add -p src/pages/index.astro
git add tests/calculator-input-contract.test.mjs
git commit -m "style: place stimulant editor beneath slot"
```
