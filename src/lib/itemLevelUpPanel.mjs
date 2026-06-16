import { applyItemLevelUp, clearItemLevelUpSlot, applyItemLevelUpMode, computeAccumulatedStats, computeStatBreakdown, computeItemLevelUpCardMeta, computeAppliedScrollCount, computeRemainingSlots, computeGradeColor } from './enhancementState.mjs';
import { statLabelByKey } from './makerData.mjs';
import { HP_MP_KEYS } from './enhancementState.mjs';

function formatSigned(value) {
	return value > 0 ? `+${value}` : String(value);
}

function summarizeStats(stats = {}) {
	const parts = [];
	for (const [key, value] of Object.entries(stats)) {
		if (!Number.isFinite(value) || value === 0) continue;
		const label = statLabelByKey[key] ?? key;
		const shortLabel = label.length >= 3 ? label[0] : label;
		parts.push(`${shortLabel}${formatSigned(value)}`);
	}
	return parts.join(' ') || '적용됨';
}

export function initItemLevelUpPanel({
	toggle,
	area,
	slots,
	editor,
	renderEnhancedItemCard,
	onToggleOpen,
}) {
	let enhancementState = null;
	let selectedBaseItem = null;
	let definition = null;
	let activeSlotIndex = -1;
	let lastAppliedValues = null;

	const hasItemLevelUpContributions = () =>
		enhancementState?.itemLevelUpSlots?.some((slot) => slot !== null);

	const updateItemLevelUpToggleLabel = () => {
		if (!(toggle instanceof HTMLElement)) return;
		toggle.textContent = hasItemLevelUpContributions() ? '아이템 레벨업 ✓' : '아이템 레벨업';
	};

	const refreshEnhancedCard = () => {
		if (!selectedBaseItem || !enhancementState) return;
		const accumulatedStats = computeAccumulatedStats(selectedBaseItem.stats, enhancementState);
		const statBreakdown = computeStatBreakdown(selectedBaseItem.stats, enhancementState);
		const remaining = computeRemainingSlots(enhancementState);
		const appliedCount = computeAppliedScrollCount(enhancementState);
		const gradeColor = computeGradeColor(enhancementState);
		const itemLevelUpMeta = computeItemLevelUpCardMeta(enhancementState, definition);
		renderEnhancedItemCard(selectedBaseItem, accumulatedStats, remaining, appliedCount, gradeColor, statBreakdown, itemLevelUpMeta);
	};

	const findNextEmptySlotIndex = () => {
		if (!enhancementState) return -1;
		return enhancementState.itemLevelUpSlots.findIndex((slot) => slot === null);
	};

	const hideEditor = () => {
		activeSlotIndex = -1;
		if (editor instanceof HTMLElement) {
			editor.hidden = true;
			editor.replaceChildren();
		}
	};

	const clampValue = (value, range) => Math.max(range.min, Math.min(range.max, value));

	const renderSlots = () => {
		if (!(slots instanceof HTMLElement) || !enhancementState || !definition) return;
		slots.replaceChildren();

		for (let i = 0; i < enhancementState.itemLevelUpSlotCount; i++) {
			const slot = enhancementState.itemLevelUpSlots[i];
			const box = document.createElement('div');
			box.className = 'item-level-up-slot';
			box.setAttribute('role', 'button');
			box.setAttribute('tabindex', '0');

			if (slot) box.classList.add('item-level-up-slot--filled');
			if (i === activeSlotIndex) box.classList.add('item-level-up-slot--active');

			const label = document.createElement('span');
			label.className = 'item-level-up-slot-label';
			label.textContent = `Lv ${i + 1}`;
			box.append(label);

			const summary = document.createElement('span');
			summary.className = 'item-level-up-slot-summary';
			summary.textContent = slot ? summarizeStats(slot.stats) : '(입력)';
			box.append(summary);

			if (slot) {
				const xBtn = document.createElement('span');
				xBtn.setAttribute('role', 'button');
				xBtn.setAttribute('tabindex', '0');
				xBtn.className = 'slot-box-x';
				xBtn.setAttribute('aria-label', `아이템 레벨업 ${i + 1} 지우기`);
				xBtn.textContent = '×';
				xBtn.addEventListener('click', (event) => {
					event.stopPropagation();
					clearItemLevelUpSlot(enhancementState, i);
					hideEditor();
					updateItemLevelUpToggleLabel();
					renderSlots();
					refreshEnhancedCard();
				});
				xBtn.addEventListener('keydown', (event) => {
					if (event.key === 'Enter' || event.key === ' ') {
						event.preventDefault();
						xBtn.click();
					}
				});
				box.append(xBtn);
			}

			box.addEventListener('click', () => {
				renderEditor(i);
			});
			box.addEventListener('keydown', (event) => {
				if (event.key === 'Enter' || event.key === ' ') {
					event.preventDefault();
					box.click();
				}
			});

			slots.append(box);
		}
	};

	const renderEditor = (slotIndex) => {
		if (!(editor instanceof HTMLElement) || !enhancementState || !definition) return;
		activeSlotIndex = slotIndex;
		editor.hidden = false;
		editor.replaceChildren();
		renderSlots();

		const currentStats = enhancementState.itemLevelUpSlots[slotIndex]?.stats ?? {};
		const values = new Map();
		const slotIsEmpty = Object.keys(currentStats).length === 0;

		for (const [key, range] of Object.entries(definition.statRanges ?? {})) {
			if (Number.isFinite(currentStats[key])) {
				values.set(key, currentStats[key]);
			} else if (slotIsEmpty && lastAppliedValues?.has(key)) {
				values.set(key, lastAppliedValues.get(key));
			} else {
				values.set(key, range.min);
			}

			const row = document.createElement('div');
			row.className = 'chaos-stat-row item-level-up-stat-row';

			const label = document.createElement('span');
			label.className = 'chaos-stat-label';
			label.textContent = statLabelByKey[key] ?? key;

			const updateDisplay = () => {
				valueDisplay.textContent = formatSigned(values.get(key) ?? 0);
			};

			const step = HP_MP_KEYS.has(key) ? 10 : 1;

			const minBtn = document.createElement('button');
			minBtn.type = 'button';
			minBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
			minBtn.textContent = 'MIN';
			minBtn.addEventListener('click', () => {
				values.set(key, range.min);
				updateDisplay();
			});

			const minusBtn = document.createElement('button');
			minusBtn.type = 'button';
			minusBtn.className = 'chaos-stepper-btn';
			minusBtn.textContent = '−';
			minusBtn.addEventListener('click', () => {
				values.set(key, clampValue((values.get(key) ?? 0) - step, range));
				updateDisplay();
			});

			const valueDisplay = document.createElement('span');
			valueDisplay.className = 'chaos-stepper-value item-level-up-stepper-value';
			updateDisplay();

			const plusBtn = document.createElement('button');
			plusBtn.type = 'button';
			plusBtn.className = 'chaos-stepper-btn';
			plusBtn.textContent = '+';
			plusBtn.addEventListener('click', () => {
				values.set(key, clampValue((values.get(key) ?? 0) + step, range));
				updateDisplay();
			});

			const maxBtn = document.createElement('button');
			maxBtn.type = 'button';
			maxBtn.className = 'chaos-stepper-btn chaos-stepper-btn--max';
			maxBtn.textContent = 'MAX';
			maxBtn.addEventListener('click', () => {
				values.set(key, range.max);
				updateDisplay();
			});

			row.append(label, minBtn, minusBtn, valueDisplay, plusBtn, maxBtn);
			editor.append(row);
		}

		const applyBtn = document.createElement('button');
		applyBtn.type = 'button';
		applyBtn.className = 'chaos-apply-button item-level-up-apply-button';
		applyBtn.textContent = '적용';
		applyBtn.addEventListener('click', () => {
			const stats = {};
			for (const [key, value] of values.entries()) {
				stats[key] = value;
			}
			applyItemLevelUp(enhancementState, slotIndex, stats);
			lastAppliedValues = new Map(values);
			updateItemLevelUpToggleLabel();
			renderSlots();
			refreshEnhancedCard();
			const nextEmpty = findNextEmptySlotIndex();
			if (nextEmpty >= 0) {
				renderEditor(nextEmpty);
			} else {
				hideEditor();
				renderSlots();
			}
		});

		editor.append(applyBtn);
	};

	if (toggle instanceof HTMLElement) {
		toggle.addEventListener('click', () => {
			if (!definition || !enhancementState) return;
			if (area instanceof HTMLElement) {
				const wasHidden = area.hidden;
				area.hidden = !area.hidden;
				if (!area.hidden) {
					toggle.classList.add('item-level-up-toggle--active');
					onToggleOpen?.();
					const section = area.closest('.maker-section') ?? area;
					section.scrollIntoView({ behavior: 'smooth', block: 'start' });
						renderModeToggle();
					if (findNextEmptySlotIndex() >= 0) {
						renderEditor(findNextEmptySlotIndex());
					}
				} else {
					toggle.classList.remove('item-level-up-toggle--active');
				}
			}
		});
	}


  const renderModeToggle = () => {
    if (!(area instanceof HTMLElement)) return;
    const existing = area.querySelector('.maker-mode-toggle-row');
    if (existing) existing.remove();

    const toggleRow = document.createElement('div');
    toggleRow.className = 'maker-mode-toggle-row';

    const toggleLabel = document.createElement('label');
    toggleLabel.className = 'maker-mode-toggle-label';
    toggleLabel.textContent = '확률 계산에 포함';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'maker-mode-toggle-checkbox';
    checkbox.checked = enhancementState?.itemLevelUpMode === 'probability';
    checkbox.addEventListener('change', () => {
      if (enhancementState) {
        applyItemLevelUpMode(enhancementState, checkbox.checked ? 'probability' : 'manual');
      }
    });

    toggleLabel.prepend(checkbox);
    toggleRow.append(toggleLabel);
    area.insertBefore(toggleRow, area.firstChild);
  };

	return {
		activate(enhState, item, levelUpDefinition) {
			enhancementState = enhState;
			selectedBaseItem = item;
			definition = levelUpDefinition ?? null;
			hideEditor();

			if (toggle instanceof HTMLElement) {
				toggle.hidden = !definition;
			}

			if (area instanceof HTMLElement) {
				area.hidden = true;
			}

			if (definition) {
				updateItemLevelUpToggleLabel();
				renderSlots();
      renderModeToggle();
			}
		},
		reset() {
			hideEditor();
			updateItemLevelUpToggleLabel();
			if (area instanceof HTMLElement) area.hidden = true;
			renderSlots();
		},
		closeArea() {
			hideEditor();
			if (area instanceof HTMLElement) area.hidden = true;
			if (toggle instanceof HTMLElement) toggle.classList.remove('item-level-up-toggle--active');
		},
		deactivate() {
			enhancementState = null;
			selectedBaseItem = null;
			definition = null;
			lastAppliedValues = null;
			if (toggle instanceof HTMLElement) {
				toggle.textContent = '아이템 레벨업';
			}
			hideEditor();
			if (toggle instanceof HTMLElement) {
				toggle.hidden = true;
				toggle.classList.remove('item-level-up-toggle--active');
			}
			if (area instanceof HTMLElement) area.hidden = true;
			if (slots instanceof HTMLElement) slots.replaceChildren();
		},
	};
}
