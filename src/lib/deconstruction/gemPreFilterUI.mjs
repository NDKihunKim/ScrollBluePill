// ---- Gem pre-filter picker UI builder ----

export function buildGemPreFilter({
  container,
  selectedItem,
  gemFilter,
  GEM_TYPES,
  GEM_GRADES,
  GEM_ITEM_IDS,
  isWeaponKind,
  statLabelByKey,
  buildItemIconUrl,
  guardMutation,
  onStateChange,
}) {
  if (!(container instanceof globalThis.HTMLElement)) return;
  if (!selectedItem) return;

  const equipmentKind = selectedItem.equipmentKind;

  container.replaceChildren();

  const topRow = document.createElement('div');
  topRow.className = 'decon-gem-top-row';

  const label = document.createElement('p');
  label.className = 'decon-gem-picker-label';
  label.textContent = '보석 종류 선택';
  topRow.append(label);

  const actions = document.createElement('div');
  actions.className = 'decon-gem-actions';

  let currentGradeGem = null;

  const selectAllBtn = document.createElement('button');
  selectAllBtn.type = 'button';
  selectAllBtn.className = 'decon-gem-action-btn';
  selectAllBtn.textContent = '전체 선택';
  selectAllBtn.addEventListener('click', () =>
    guardMutation(() => {
      if (currentGradeGem) {
        for (let gi = 0; gi < GEM_GRADES.length; gi++) {
          gemFilter.add(`${currentGradeGem.key}:${gi}`);
        }
        renderGrades(currentGradeGem);
        if (onStateChange) onStateChange();
      } else {
        for (const g of GEM_TYPES) {
          if (g.weaponOnly && !isWeaponKind(equipmentKind)) continue;
          for (let gi = 0; gi < GEM_GRADES.length; gi++) {
            gemFilter.add(`${g.key}:${gi}`);
          }
        }
        renderCategories();
        if (onStateChange) onStateChange();
      }
    }),
  );
  actions.append(selectAllBtn);

  const deselectAllBtn = document.createElement('button');
  deselectAllBtn.type = 'button';
  deselectAllBtn.className = 'decon-gem-action-btn';
  deselectAllBtn.textContent = '전체 해제';
  deselectAllBtn.addEventListener('click', () =>
    guardMutation(() => {
      if (currentGradeGem) {
        for (let gi = 0; gi < GEM_GRADES.length; gi++) {
          gemFilter.delete(`${currentGradeGem.key}:${gi}`);
        }
        if (onStateChange) onStateChange();
        renderGrades(currentGradeGem);
      } else {
        for (const g of GEM_TYPES) {
          if (g.weaponOnly && !isWeaponKind(equipmentKind)) continue;
          for (let gi = 0; gi < GEM_GRADES.length; gi++) {
            gemFilter.delete(`${g.key}:${gi}`);
          }
        }
        if (onStateChange) onStateChange();
        renderCategories();
      }
    }),
  );
  actions.append(deselectAllBtn);

  topRow.append(actions);
  container.append(topRow);

  const contentArea = document.createElement('div');
  contentArea.className = 'decon-gem-content';
  container.append(contentArea);

  const renderCategories = () => {
    currentGradeGem = null;
    contentArea.replaceChildren();

    const grid = document.createElement('div');
    grid.className = 'decon-gem-grid';

    for (const gem of GEM_TYPES) {
      if (gem.weaponOnly && !isWeaponKind(equipmentKind)) continue;

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'decon-gem-category';

      let hasSelectedGrade = false;
      for (let gi = 0; gi < GEM_GRADES.length; gi++) {
        if (gemFilter.has(`${gem.key}:${gi}`)) {
          hasSelectedGrade = true;
          break;
        }
      }
      if (hasSelectedGrade) card.classList.add('decon-gem-category--selected');

      const baseId = GEM_ITEM_IDS[gem.key]?.base;
      if (baseId) {
        const icon = document.createElement('img');
        icon.src = buildItemIconUrl(baseId);
        icon.alt = '';
        icon.loading = 'lazy';
        card.append(icon);
      }

      const name = document.createElement('span');
      name.textContent = gem.nameKo;
      card.append(name);

      if (gem.key !== 'darkCrystal') {
        const statSub = document.createElement('span');
        statSub.className = 'decon-gem-category-stat';
        if (gem.behavior === 'variable') {
          const keyLabels = (gem.variableKeys ?? []).map((k) => statLabelByKey[k] ?? k);
          statSub.textContent = `(${keyLabels.join('/')})`;
        } else {
          statSub.textContent = `(${statLabelByKey[gem.stat] ?? gem.stat})`;
        }
        card.append(statSub);
      }

      card.addEventListener('click', () => renderGrades(gem));
      grid.append(card);
    }

    contentArea.append(grid);
  };

  const renderGrades = (gem) => {
    currentGradeGem = gem;
    contentArea.replaceChildren();

    const header = document.createElement('div');
    header.className = 'decon-gem-picker-header';

    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'decon-gem-back';
    backBtn.textContent = '← 뒤로';
    backBtn.addEventListener('click', renderCategories);
    header.append(backBtn);

    const baseId = GEM_ITEM_IDS[gem.key]?.base;
    if (baseId) {
      const icon = document.createElement('img');
      icon.src = buildItemIconUrl(baseId);
      icon.alt = '';
      icon.loading = 'lazy';
      header.append(icon);
    }

    const nameEl = document.createElement('span');
    nameEl.className = 'decon-gem-name';
    nameEl.textContent = gem.nameKo;
    header.append(nameEl);

    contentArea.append(header);

    const gradesList = document.createElement('div');
    gradesList.className = 'decon-gem-grades';

    for (let gradeIndex = 0; gradeIndex < GEM_GRADES.length; gradeIndex++) {
      const gradeLabel = GEM_GRADES[gradeIndex];

      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'decon-gem-grade';

      const filterKey = `${gem.key}:${gradeIndex}`;
      const isSelected = gemFilter?.has(filterKey) ?? true;
      if (isSelected) row.classList.add('decon-gem-grade--selected');

      const gradeKey = ['low', 'mid', 'high'][gradeIndex];
      const gradeIconId = GEM_ITEM_IDS[gem.key]?.[gradeKey];
      if (gradeIconId) {
        const gradeIcon = document.createElement('img');
        gradeIcon.src = buildItemIconUrl(gradeIconId);
        gradeIcon.alt = '';
        gradeIcon.loading = 'lazy';
        row.append(gradeIcon);
      }

      const gradeName = document.createElement('span');
      gradeName.textContent = gradeLabel;
      row.append(gradeName);

      const statSpan = document.createElement('span');
      statSpan.className = 'decon-gem-category-stat';
      if (gem.stat && gem.values) {
        const val = gem.values[gradeIndex];
        const dispLabel = statLabelByKey[gem.stat] || gem.stat;
        statSpan.textContent = `${dispLabel} +${val}`;
      } else if (gem.behavior === 'variable') {
        const isDark = gem.key === 'darkCrystal';
        const ranges = isDark
          ? ['-2 ~ +2', '-3 ~ +3', '-5 ~ +5']
          : ['-1 ~ +1', '-2 ~ +2', '-3 ~ +3'];
        statSpan.textContent = ranges[gradeIndex];
      }
      row.append(statSpan);

      row.addEventListener('click', () => {
        guardMutation(() => {
          if (gemFilter.has(filterKey)) {
            gemFilter.delete(filterKey);
            row.classList.remove('decon-gem-grade--selected');
          } else {
            gemFilter.add(filterKey);
            row.classList.add('decon-gem-grade--selected');
          }
          if (onStateChange) onStateChange();
        });
      });

      gradesList.append(row);
    }

    contentArea.append(gradesList);
    if (onStateChange) onStateChange();
  };

  renderCategories();
}
