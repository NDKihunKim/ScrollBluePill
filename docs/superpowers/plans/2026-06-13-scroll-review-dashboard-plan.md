# Scroll Review Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the Item Review Dashboard with an Equipment/Scrolls toggle that shows and edits scroll_definitions data with category-appropriate columns, filters, and edit form.

**Architecture:** Modify the generator script to fetch both tables and embed both datasets. Extend the single-page dashboard template with an `activeType` state that drives conditional rendering of summary cards, filter chips, table columns, sort options, CSV export, and the edit modal.

**Tech Stack:** Node.js (fetch + fs/promises), vanilla HTML/CSS/JS, Supabase REST API (PATCH for edits), MapleStory.io icon CDN

**Files:**
- Modify: `scripts/generate-item-review-page.mjs`
- Modify: `outputs/item-review.template.html`

---

### Task 1: Update generator to fetch and embed scroll data

**Files:**
- Modify: `scripts/generate-item-review-page.mjs`

- [ ] **Step 1: Add `fetchAllScrolls` function after `fetchAllItems`**

Add this function immediately after the `fetchAllItems` function (after line 48):

```js
async function fetchAllScrolls(key) {
  const pageSize = 1000;
  const rows = [];

  while (true) {
    const url = new URL('/rest/v1/scroll_definitions', supabaseUrl);
    url.searchParams.set('select', '*');
    url.searchParams.set('limit', String(pageSize));
    url.searchParams.set('offset', String(rows.length));
    const res = await fetch(url, {
      headers: { apikey: key, authorization: `Bearer ${key}` },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Supabase error ${res.status}: ${body}`);
    }
    const page = await res.json();
    if (!Array.isArray(page) || page.length === 0) break;
    rows.push(...page);
    console.log(`  Fetched ${rows.length} scrolls...`);
  }
  return rows.map((r) => ({
    id: r.id,
    displayId: r.maplestory_io_item_id,
    nameKo: r.name_ko,
    category: r.category,
    behaviorType: r.behavior_type,
    publishedStatus: r.published_status,
    affectedStats: r.affected_stats ?? [],
    stats: r.stat_effect_frame ?? {},
    targetItemId: r.target_item_id,
    maxApplications: r.max_applications,
  }));
}
```

- [ ] **Step 2: Update `main()` to fetch scrolls and embed both datasets**

Replace the `main` function (lines 50-76) with:

```js
async function main() {
  const key = supabaseServiceRoleKey || (() => {
    console.error('SUPABASE_SERVICE_ROLE_KEY is required to fetch all items.');
    process.exit(1);
  })();

  console.log('Fetching all items from Supabase...');
  const allItems = await fetchAllItems(key);
  console.log(`Fetched ${allItems.length} items total.`);

  console.log('Fetching all scrolls from Supabase...');
  const allScrolls = await fetchAllScrolls(key);
  console.log(`Fetched ${allScrolls.length} scrolls total.`);

  // Read the template HTML
  const template = await readFile(htmlTemplatePath, 'utf8');

  // Embed both datasets as JSON blobs
  const itemsJson = JSON.stringify(allItems);
  const scrollsJson = JSON.stringify(allScrolls);
  const html = template
    .replace(
      '/* __ITEM_DATA_PLACEHOLDER__ */',
      `window.__ITEM_DATA__ = ${itemsJson};`,
    )
    .replace(
      '/* __SCROLL_DATA_PLACEHOLDER__ */',
      `window.__SCROLL_DATA__ = ${scrollsJson};`,
    );

  await mkdir(dirname(htmlOutputPath), { recursive: true });
  await writeFile(htmlOutputPath, html);
  const totalMB = ((itemsJson.length + scrollsJson.length) / 1024 / 1024).toFixed(1);
  console.log(`Generated ${htmlOutputPath} (${itemsJson.length / 1024 / 1024} MB items, ${scrollsJson.length / 1024 / 1024} MB scrolls — ${totalMB} MB total embedded data)`);
  console.log('Open it in your browser or run: npm run review:items');
}

await main();
```

- [ ] **Step 3: Run the generator to verify it works**

Run: `npm run generate:item-review`
Expected: Console shows item and scroll fetch counts, generates `outputs/item-review.html` with both `window.__ITEM_DATA__` and `window.__SCROLL_DATA__` embedded.

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-item-review-page.mjs
git commit -m "feat: fetch and embed scroll_definitions data in item review generator

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Add scroll data placeholder and type toggle CSS/HTML

**Files:**
- Modify: `outputs/item-review.template.html`

- [ ] **Step 1: Add type toggle CSS after the `.key-btn` style rule (after line 57)**

Insert after line 57 (the `.header .key-btn` rule closing `}`):

```css
.type-toggle {
  display: flex; gap: 0; border: 1px solid var(--line); border-radius: 6px; overflow: hidden;
}
.type-toggle button {
  padding: 6px 18px; border: none; background: var(--surface); cursor: pointer;
  font: inherit; font-size: 0.85rem; font-weight: 600; color: var(--muted);
  transition: background 0.15s, color 0.15s;
}
.type-toggle button.active { background: var(--blue); color: #fff; }
```

- [ ] **Step 2: Add `id="filters"` to the filters div and add type toggle HTML in the header**

In the filters div, change `<div class="filters">` to `<div class="filters" id="filters">`.

Then replace the header div (lines 208-211) with:

```html
<div class="header">
  <div style="display:flex;align-items:center;gap:16px">
    <h1>Item Review Dashboard</h1>
    <div class="type-toggle" id="type-toggle">
      <button id="toggle-equipment" class="active" onclick="switchType('equipment')">Equipment</button>
      <button id="toggle-scrolls" onclick="switchType('scroll')">Scrolls</button>
    </div>
  </div>
  <span id="key-label" style="font-size:0.85rem;color:var(--muted)">All items (embedded)</span>
</div>
```

- [ ] **Step 3: Add scroll data placeholder in the script block**

Add this line immediately after the `/* __ITEM_DATA_PLACEHOLDER__ */` line:

```
/* __SCROLL_DATA_PLACEHOLDER__ */
```

- [ ] **Step 4: Add activeType state and switchType function**

In the State section (after `let currentPage = 1;` on line 305), add:

```js
let activeType = 'equipment';
let allScrolls = [];
let filteredScrolls = [];
```

Add the `switchType` function after the `init` function (after line 317):

```js
function switchType(type) {
  activeType = type;
  document.getElementById('toggle-equipment').classList.toggle('active', type === 'equipment');
  document.getElementById('toggle-scrolls').classList.toggle('active', type === 'scroll');
  document.getElementById('key-label').textContent = type === 'equipment' ? 'All items (embedded)' : 'All scrolls (embedded)';
  currentPage = 1;
  sortCol = type === 'equipment' ? 'id' : 'displayId';
  sortDir = 1;
  renderAll();
}
```

- [ ] **Step 5: Update init() to load scroll data and call renderAll correctly**

Replace the `init` function (lines 310-317) with:

```js
function init() {
  if (!window.__ITEM_DATA__ || !Array.isArray(window.__ITEM_DATA__)) {
    document.getElementById('tbody').innerHTML = '<tr><td colspan="9" class="error-msg">No embedded data found. Run: npm run generate:item-review</td></tr>';
    return;
  }
  allItems = window.__ITEM_DATA__;
  allScrolls = window.__SCROLL_DATA__ || [];
  renderAll();
}
```

- [ ] **Step 6: Commit**

```bash
git add outputs/item-review.template.html
git commit -m "feat: add type toggle HTML/CSS/state for equipment/scrolls switch

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Add conditional filter rendering for scrolls

**Files:**
- Modify: `outputs/item-review.template.html`

- [ ] **Step 1: Replace `buildKindSelect` with `buildFilters` that adapts to type**

Replace the `buildKindSelect` function (lines 332-339) with:

```js
function buildFilters() {
  const container = document.getElementById('filters');
  container.innerHTML = '';

  // Text search — always present
  const searchInput = document.createElement('input');
  searchInput.className = 'search';
  searchInput.type = 'text';
  searchInput.id = 'filter-text';
  searchInput.placeholder = 'Search name or ID...';
  searchInput.oninput = () => renderTable(true);
  container.appendChild(searchInput);

  if (activeType === 'equipment') {
    // Equipment Kind dropdown
    const kindGroup = document.createElement('div');
    kindGroup.className = 'filter-group';
    kindGroup.innerHTML = '<label>Equipment Kind</label>';
    const kindSel = document.createElement('select');
    kindSel.id = 'filter-kind';
    kindSel.onchange = () => renderTable(true);
    const kinds = [...new Set(allItems.map(i => i.equipmentKind))].sort();
    kinds.forEach(k => { const opt = document.createElement('option'); opt.value = k; opt.textContent = k; kindSel.appendChild(opt); });
    const allOpt = document.createElement('option');
    allOpt.value = ''; allOpt.textContent = 'All';
    kindSel.insertBefore(allOpt, kindSel.firstChild);
    kindGroup.appendChild(kindSel);
    container.appendChild(kindGroup);

    // Job chips
    buildChipGroup(container, 'Jobs', 'filter-jobs', ['Warrior','Magician','Bowman','Thief','Pirate','Beginner'], jobFilters);
  } else {
    // Category dropdown for scrolls
    const catGroup = document.createElement('div');
    catGroup.className = 'filter-group';
    catGroup.innerHTML = '<label>Category</label>';
    const catSel = document.createElement('select');
    catSel.id = 'filter-category';
    catSel.onchange = () => renderTable(true);
    const cats = [...new Set(allScrolls.map(s => s.category))].sort();
    cats.forEach(c => { const opt = document.createElement('option'); opt.value = c; opt.textContent = c; catSel.appendChild(opt); });
    const allOpt = document.createElement('option');
    allOpt.value = ''; allOpt.textContent = 'All';
    catSel.insertBefore(allOpt, catSel.firstChild);
    catGroup.appendChild(catSel);
    container.appendChild(catGroup);

    // Behavior Type chips
    buildChipGroup(container, 'Behavior', 'filter-behavior', ['fixed','random'], behaviorFilters);

    // Level filter — hidden for scrolls but keep the DOM element hidden
  }

  // Status chips — always present
  buildChipGroup(container, 'Status', 'filter-status', ['published','draft','hidden'], statusFilters);

  // Level range — equipment only
  if (activeType === 'equipment') {
    const lvGroup = document.createElement('div');
    lvGroup.className = 'filter-group';
    lvGroup.innerHTML = '<label>Level</label><div class="level-inputs"><input type="number" id="filter-lvmin" placeholder="Min" onchange="renderTable(true)"><span style="color:var(--muted)">–</span><input type="number" id="filter-lvmax" placeholder="Max" onchange="renderTable(true)"></div>';
    container.appendChild(lvGroup);
  }

  // Korean Name chips — always present
  buildToggleChips(container, 'Korean Name', 'filter-korean', [{v:'all',l:'All'},{v:'yes',l:'Has'},{v:'no',l:'Missing'}], () => koreanFilter, (v) => { koreanFilter = v; });

  // Has Stats chips — always present
  buildToggleChips(container, 'Has Stats', 'filter-stats', [{v:'all',l:'All'},{v:'yes',l:'Has'},{v:'no',l:'None'}], () => statsFilter, (v) => { statsFilter = v; });
}

function buildChipGroup(container, label, id, values, selectedSet) {
  const group = document.createElement('div');
  group.className = 'filter-group';
  group.innerHTML = `<label>${label}</label>`;
  const chipsDiv = document.createElement('div');
  chipsDiv.className = 'chips';
  chipsDiv.id = id;
  values.forEach(v => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (selectedSet.has(v) ? ' on' : '');
    chip.textContent = v;
    chip.onclick = () => {
      if (selectedSet.has(v)) selectedSet.delete(v); else selectedSet.add(v);
      chip.classList.toggle('on');
      renderTable(true);
    };
    chipsDiv.appendChild(chip);
  });
  group.appendChild(chipsDiv);
  container.appendChild(group);
}

function buildToggleChips(container, label, id, options, getter, setter) {
  const group = document.createElement('div');
  group.className = 'filter-group';
  group.innerHTML = `<label>${label}</label>`;
  const chipsDiv = document.createElement('div');
  chipsDiv.className = 'chips';
  chipsDiv.id = id;
  options.forEach(o => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (getter() === o.v ? ' on' : '');
    chip.textContent = o.l;
    chip.onclick = () => {
      setter(o.v);
      chipsDiv.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
      renderTable(true);
    };
    chipsDiv.appendChild(chip);
  });
  group.appendChild(chipsDiv);
  container.appendChild(group);
}
```

- [ ] **Step 2: Add `behaviorFilters` state**

In the State section, after `let statusFilters`, add:

```js
let behaviorFilters = new Set(['fixed','random']);
```

- [ ] **Step 3: Remove old filter builder calls from `renderAll`**

Replace the `renderAll` function (lines 321-329) with:

```js
function renderAll() {
  buildFilters();
  renderSummary();
  renderTable();
}
```

- [ ] **Step 4: Remove old `buildJobChips`, `buildStatusChips`, `buildToggles`, `buildKindSelect` functions**

Delete these four functions (lines 332-401). They are replaced by `buildFilters`, `buildChipGroup`, and `buildToggleChips`.

- [ ] **Step 5: Replace `filterItems` with type-aware version**

Replace the `filterItems` function (lines 422-448) with:

```js
function filterItems() {
  if (activeType === 'equipment') {
    filterEquipment();
  } else {
    filterScrolls();
  }
}

function filterEquipment() {
  const text = (document.getElementById('filter-text')?.value || '').toLowerCase();
  const kind = document.getElementById('filter-kind')?.value || '';
  const lvmin = parseInt(document.getElementById('filter-lvmin')?.value) || 0;
  const lvmax = parseInt(document.getElementById('filter-lvmax')?.value) || 999;

  filteredItems = allItems.filter(i => {
    if (!statusFilters.has(i.publishedStatus)) return false;
    if (kind && i.equipmentKind !== kind) return false;
    if (i.requiredLevel < lvmin || i.requiredLevel > lvmax) return false;
    if (koreanFilter === 'yes' && !/[가-힣]/.test(i.nameKo)) return false;
    if (koreanFilter === 'no' && /[가-힣]/.test(i.nameKo)) return false;
    if (statsFilter === 'yes' && Object.keys(i.stats).length === 0) return false;
    if (statsFilter === 'no' && Object.keys(i.stats).length > 0) return false;
    if (i.requiredJobs.length > 0) {
      const hasMatchingJob = i.requiredJobs.some(j => jobFilters.has(j));
      if (!hasMatchingJob) return false;
    }
    if (text) {
      const searchTarget = `${i.id} ${i.nameKo} ${i.nameEn}`.toLowerCase();
      if (!searchTarget.includes(text)) return false;
    }
    return true;
  });
}

function filterScrolls() {
  const text = (document.getElementById('filter-text')?.value || '').toLowerCase();
  const category = document.getElementById('filter-category')?.value || '';

  filteredScrolls = allScrolls.filter(s => {
    if (!statusFilters.has(s.publishedStatus)) return false;
    if (category && s.category !== category) return false;
    if (!behaviorFilters.has(s.behaviorType)) return false;
    if (koreanFilter === 'yes' && !/[가-힣]/.test(s.nameKo)) return false;
    if (koreanFilter === 'no' && /[가-힣]/.test(s.nameKo)) return false;
    if (statsFilter === 'yes' && Object.keys(s.stats).length === 0) return false;
    if (statsFilter === 'no' && Object.keys(s.stats).length > 0) return false;
    if (text) {
      const searchTarget = `${s.displayId} ${s.nameKo}`.toLowerCase();
      if (!searchTarget.includes(text)) return false;
    }
    return true;
  });
}
```

- [ ] **Step 6: Commit**

```bash
git add outputs/item-review.template.html
git commit -m "feat: add conditional filter rendering for equipment and scroll types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: Add scroll table rendering

**Files:**
- Modify: `outputs/item-review.template.html`

- [ ] **Step 1: Add helper to get current active data**

Add this function after the state declarations:

```js
function activeData() {
  return activeType === 'equipment' ? allItems : allScrolls;
}

function activeFiltered() {
  return activeType === 'equipment' ? filteredItems : filteredScrolls;
}
```

- [ ] **Step 2: Replace `sortBy` with type-aware version**

Replace the `sortBy` function (lines 450-458) with:

```js
function sortBy(col) {
  if (sortCol === col) { sortDir = -sortDir; }
  else { sortCol = col; sortDir = 1; }

  // Resolve col name to display label for arrow placement
  const labelMap = activeType === 'equipment'
    ? { id:'ID', nameKo:'Name KO', nameEn:'Name EN', equipmentKind:'Kind', requiredLevel:'Lv', publishedStatus:'Status' }
    : { displayId:'ID', nameKo:'Name KO', category:'Category', publishedStatus:'Status' };

  const label = labelMap[col] || '';
  document.querySelectorAll('th .sort-arrow').forEach(s => s.textContent = '');
  document.querySelectorAll('th').forEach(th => {
    if (th.textContent.trim().startsWith(label)) {
      th.querySelector('.sort-arrow').textContent = sortDir === 1 ? '▲' : '▼';
    }
  });
  renderTable(true);
}
```

- [ ] **Step 3: Replace `renderSummary` with type-aware version**

Replace the `renderSummary` function (lines 404-419) with:

```js
function renderSummary() {
  const data = activeData();
  const pub = data.filter(i => i.publishedStatus === 'published').length;
  const draft = data.filter(i => i.publishedStatus === 'draft').length;
  const hidden = data.filter(i => i.publishedStatus === 'hidden').length;
  const noKorean = data.filter(i => !/[가-힣]/.test(i.nameKo)).length;
  const noStats = data.filter(i => Object.keys(i.stats).length === 0).length;
  const label = activeType === 'equipment' ? 'Items' : 'Scrolls';
  document.getElementById('summary').innerHTML = `
    <div class="summary-card total"><div class="label">Total ${label}</div><div class="value">${data.length}</div></div>
    <div class="summary-card pub"><div class="label">Published</div><div class="value">${pub}</div></div>
    <div class="summary-card draft"><div class="label">Draft</div><div class="value">${draft}</div></div>
    <div class="summary-card hidden-card"><div class="label">Hidden</div><div class="value">${hidden}</div></div>
    <div class="summary-card"><div class="label">No Korean</div><div class="value">${noKorean}</div></div>
    <div class="summary-card"><div class="label">No Stats</div><div class="value">${noStats}</div></div>
  `;
}
```

- [ ] **Step 4: Replace `renderTable` with type-aware version**

Replace the `renderTable` function (lines 461-521) with:

```js
function renderTable(resetPage) {
  if (resetPage) currentPage = 1;
  filterItems();

  const filtered = activeFiltered();
  const col = sortCol;

  filtered.sort((a, b) => {
    let va = a[col], vb = b[col];
    if (typeof va === 'string') va = va.toLowerCase();
    if (typeof vb === 'string') vb = vb.toLowerCase();
    if (va == null) va = '';
    if (vb == null) vb = '';
    if (va < vb) return -1 * sortDir;
    if (va > vb) return 1 * sortDir;
    return 0;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE) || 1;
  if (currentPage > totalPages) currentPage = totalPages;
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtered.slice(start, start + PAGE_SIZE);

  const tbody = document.getElementById('tbody');
  tbody.innerHTML = '';

  // Update table header based on type
  updateTableHeader();

  pageItems.forEach((item, pageIdx) => {
    if (activeType === 'equipment') {
      renderEquipmentRow(tbody, item, start, pageIdx);
    } else {
      renderScrollRow(tbody, item, start, pageIdx);
    }
  });

  document.getElementById('showing').innerHTML =
    'Showing ' + (start + 1) + '–' + Math.min(start + PAGE_SIZE, filtered.length) +
    ' of ' + filtered.length + ' ' + (activeType === 'equipment' ? 'items' : 'scrolls') +
    ' (total: ' + activeData().length + ') ' +
    (totalPages > 1
      ? '<button onclick="currentPage=1;renderTable()" style="margin-left:8px;padding:2px 8px;font:inherit;font-size:0.8rem;cursor:pointer;border:1px solid var(--line);border-radius:4px;background:var(--surface)"' + (currentPage===1?' disabled':'') + '>« First</button> ' +
        '<button onclick="currentPage--;renderTable()" style="padding:2px 8px;font:inherit;font-size:0.8rem;cursor:pointer;border:1px solid var(--line);border-radius:4px;background:var(--surface)"' + (currentPage===1?' disabled':'') + '>‹ Prev</button> ' +
        '<span style="margin:0 8px;font-size:0.8rem">Page ' + currentPage + ' / ' + totalPages + '</span> ' +
        '<button onclick="currentPage++;renderTable()" style="padding:2px 8px;font:inherit;font-size:0.8rem;cursor:pointer;border:1px solid var(--line);border-radius:4px;background:var(--surface)"' + (currentPage===totalPages?' disabled':'') + '>Next ›</button> ' +
        '<button onclick="currentPage=totalPages;renderTable()" style="padding:2px 8px;font:inherit;font-size:0.8rem;cursor:pointer;border:1px solid var(--line);border-radius:4px;background:var(--surface)"' + (currentPage===totalPages?' disabled':'') + '>Last »</button>'
      : '');
}

function updateTableHeader() {
  const thead = document.querySelector('thead tr');
  if (activeType === 'equipment') {
    thead.innerHTML =
      '<th class="icon-cell"></th>' +
      '<th onclick="sortBy(\'id\')">ID <span class="sort-arrow"></span></th>' +
      '<th onclick="sortBy(\'nameKo\')">Name KO <span class="sort-arrow"></span></th>' +
      '<th onclick="sortBy(\'nameEn\')">Name EN <span class="sort-arrow"></span></th>' +
      '<th onclick="sortBy(\'equipmentKind\')">Kind <span class="sort-arrow"></span></th>' +
      '<th onclick="sortBy(\'requiredLevel\')">Lv <span class="sort-arrow"></span></th>' +
      '<th>Jobs</th>' +
      '<th>Stats</th>' +
      '<th onclick="sortBy(\'publishedStatus\')">Status <span class="sort-arrow"></span></th>' +
      '<th></th>';
  } else {
    thead.innerHTML =
      '<th class="icon-cell"></th>' +
      '<th onclick="sortBy(\'displayId\')">ID <span class="sort-arrow"></span></th>' +
      '<th onclick="sortBy(\'nameKo\')">Name KO <span class="sort-arrow"></span></th>' +
      '<th onclick="sortBy(\'category\')">Category <span class="sort-arrow"></span></th>' +
      '<th>Behavior</th>' +
      '<th>Affected Stats</th>' +
      '<th onclick="sortBy(\'publishedStatus\')">Status <span class="sort-arrow"></span></th>' +
      '<th></th>';
  }
}

function renderEquipmentRow(tbody, item, start, pageIdx) {
  const effectiveIconId = ICON_OVERRIDES[item.id] ?? item.id;
  const iconUrl = `${MAPLESTORY_IO_BASE}/api/GMS/83/item/${effectiveIconId}/icon`;
  const statEntries = Object.entries(item.stats).filter(([,v]) => Number.isFinite(v));
  const statTags = statEntries.slice(0, 4).map(([k,v]) =>
    `<span class="stat-tag">${k}: ${v > 0 ? '+' + v : v}</span>`
  ).join('');
  const moreStats = statEntries.length > 4 ? ` <span class="stat-tag">+${statEntries.length - 4}</span>` : '';
  const jobBadges = (item.requiredJobs || []).map(j =>
    `<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:0.7rem;background:${JOB_COLORS[j] || '#888'}11;color:${JOB_COLORS[j] || '#888'};margin-right:2px">${JOB_LABELS[j] || j}</span>`
  ).join('') || '-';
  const badgeClass = item.publishedStatus === 'published' ? 'pub' : item.publishedStatus === 'draft' ? 'draft' : 'hidden';
  const badgeLabel = item.publishedStatus === 'published' ? 'published' : item.publishedStatus === 'draft' ? 'draft' : 'hidden';

  tbody.innerHTML += '<tr class="expandable" onclick="toggleDetail(' + start + '+' + pageIdx + ', this)">' +
    '<td class="icon-cell"><img src="' + iconUrl + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-flex\'" crossorigin="anonymous"><span class="no-icon" style="display:none">?</span></td>' +
    '<td>' + item.id + '</td>' +
    '<td>' + esc(item.nameKo) + '</td>' +
    '<td style="font-size:0.8rem;color:var(--muted)">' + esc(item.nameEn || '') + '</td>' +
    '<td>' + esc(item.equipmentKind) + '</td>' +
    '<td>' + item.requiredLevel + '</td>' +
    '<td>' + jobBadges + '</td>' +
    '<td><div class="stats-tags">' + statTags + moreStats + '</div></td>' +
    '<td><span class="badge ' + badgeClass + '">' + badgeLabel + '</span></td>' +
    '<td><button onclick="event.stopPropagation();openEdit(' + item.id + ')" style="padding:2px 8px;font:inherit;font-size:0.75rem;cursor:pointer;border:1px solid var(--line);border-radius:4px;background:var(--surface)" title="Edit item">✏️</button></td>' +
    '</tr>';
}

function renderScrollRow(tbody, scroll, start, pageIdx) {
  const iconUrl = `${MAPLESTORY_IO_BASE}/api/GMS/83/item/${scroll.displayId}/icon`;
  const affectedTags = (scroll.affectedStats || []).slice(0, 4).map(s =>
    `<span class="stat-tag">${s}</span>`
  ).join('');
  const moreAffected = (scroll.affectedStats || []).length > 4 ? ` <span class="stat-tag">+${scroll.affectedStats.length - 4}</span>` : '';
  const behaviorTag = scroll.behaviorType === 'fixed'
    ? '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.72rem;background:#e3f2fd;color:#1565c0">fixed</span>'
    : '<span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:0.72rem;background:#e8f5e9;color:#2e7d32">random</span>';
  const badgeClass = scroll.publishedStatus === 'published' ? 'pub' : scroll.publishedStatus === 'draft' ? 'draft' : 'hidden';
  const badgeLabel = scroll.publishedStatus === 'published' ? 'published' : scroll.publishedStatus === 'draft' ? 'draft' : 'hidden';

  tbody.innerHTML += '<tr class="expandable" onclick="toggleDetail(' + start + '+' + pageIdx + ', this)">' +
    '<td class="icon-cell"><img src="' + iconUrl + '" alt="" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'inline-flex\'" crossorigin="anonymous"><span class="no-icon" style="display:none">?</span></td>' +
    '<td>' + scroll.displayId + '</td>' +
    '<td>' + esc(scroll.nameKo) + '</td>' +
    '<td>' + esc(scroll.category) + '</td>' +
    '<td>' + behaviorTag + '</td>' +
    '<td><div class="stats-tags">' + affectedTags + moreAffected + '</div></td>' +
    '<td><span class="badge ' + badgeClass + '">' + badgeLabel + '</span></td>' +
    '<td><button onclick="event.stopPropagation();openEdit(\'' + scroll.id + '\')" style="padding:2px 8px;font:inherit;font-size:0.75rem;cursor:pointer;border:1px solid var(--line);border-radius:4px;background:var(--surface)" title="Edit scroll">✏️</button></td>' +
    '</tr>';
}
```

- [ ] **Step 5: Update `exportCSV` for type awareness**

Replace the `exportCSV` function (lines 535-552) with:

```js
function exportCSV() {
  filterItems();
  const filtered = activeFiltered();
  let headers, rows;

  if (activeType === 'equipment') {
    headers = ['id','nameKo','nameEn','equipmentKind','requiredLevel','requiredJobs','requirements','stats','aliases','publishedStatus','sourceNote'];
    rows = filtered.map(i =>
      headers.map(h => {
        const val = i[h] ?? '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      })
    );
  } else {
    headers = ['displayId','nameKo','category','behaviorType','affectedStats','publishedStatus','stats','targetItemId','maxApplications'];
    rows = filtered.map(s =>
      headers.map(h => {
        const val = s[h] ?? '';
        if (typeof val === 'object') return JSON.stringify(val);
        return String(val);
      })
    );
  }

  const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${c.replace(/"/g,'""')}"`).join(','))].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = activeType === 'equipment' ? 'items-review.csv' : 'scrolls-review.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}
```

- [ ] **Step 6: Commit**

```bash
git add outputs/item-review.template.html
git commit -m "feat: add scroll table rendering with type-aware columns, sorting, and CSV export

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: Add scroll edit modal form

**Files:**
- Modify: `outputs/item-review.template.html`

- [ ] **Step 1: Replace `populateForm` with type-aware version**

Replace the `populateForm` function (lines 617-663) with:

```js
function populateForm(data) {
  document.getElementById('edit-spinner').style.display = 'none';
  document.getElementById('edit-form').style.display = 'block';

  if (activeType === 'equipment') {
    populateEquipmentForm(data);
  } else {
    populateScrollForm(data);
  }
}

function populateEquipmentForm(item) {
  document.getElementById('edit-nameKo').value = item.name_ko || '';
  document.getElementById('edit-nameEn').value = item.name_en || '';
  document.getElementById('edit-level').value = item.required_level || 0;
  document.getElementById('edit-aliases').value = (item.aliases || []).join(', ');

  const kinds = [...new Set(allItems.map(i => i.equipmentKind))].sort();
  const sel = document.getElementById('edit-kind');
  sel.innerHTML = '';
  kinds.forEach(k => { const o = document.createElement('option'); o.value = k; o.textContent = k; if (k === item.equipment_kind) o.selected = true; sel.appendChild(o); });

  const jobsDiv = document.getElementById('edit-jobs');
  jobsDiv.innerHTML = '';
  const itemJobs = new Set(item.required_jobs || []);
  EDITABLE_JOB_KEYS.forEach(j => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (itemJobs.has(j) ? ' on' : '');
    chip.textContent = JOB_LABELS[j] || j;
    chip.onclick = () => chip.classList.toggle('on');
    jobsDiv.appendChild(chip);
  });

  const statusDiv = document.getElementById('edit-status');
  statusDiv.innerHTML = '';
  [{v:'published',l:'Published'},{v:'draft',l:'Draft'},{v:'hidden',l:'Hidden'}].forEach(s => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (item.published_status === s.v ? ' on' : '');
    chip.textContent = s.l;
    chip.dataset.value = s.v;
    chip.onclick = () => {
      statusDiv.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
    };
    statusDiv.appendChild(chip);
  });

  renderKeyValueRows('edit-stats', item.stats || {}, STAT_KEYS, 'stat');
  renderKeyValueRows('edit-reqs', item.requirements || {}, ['str','dex','int','luk','pop'], 'req');
}

function populateScrollForm(scroll) {
  // Fill the form fields
  document.getElementById('edit-nameKo').value = scroll.name_ko || '';
  document.getElementById('edit-aliases').value = (scroll.affected_stats || []).join(', ');

  // Category dropdown
  const cats = [...new Set(allScrolls.map(s => s.category))].sort();
  const sel = document.getElementById('edit-category');
  sel.innerHTML = '';
  cats.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; if (c === scroll.category) o.selected = true; sel.appendChild(o); });

  // Behavior type chips
  const btDiv = document.getElementById('edit-behavior');
  btDiv.innerHTML = '';
  [{v:'fixed',l:'Fixed'},{v:'random',l:'Random'}].forEach(b => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (scroll.behavior_type === b.v ? ' on' : '');
    chip.textContent = b.l;
    chip.dataset.value = b.v;
    chip.onclick = () => {
      btDiv.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
    };
    btDiv.appendChild(chip);
  });

  // Status chips
  const statusDiv = document.getElementById('edit-status');
  statusDiv.innerHTML = '';
  [{v:'published',l:'Published'},{v:'draft',l:'Draft'},{v:'hidden',l:'Hidden'}].forEach(s => {
    const chip = document.createElement('span');
    chip.className = 'chip' + (scroll.published_status === s.v ? ' on' : '');
    chip.textContent = s.l;
    chip.dataset.value = s.v;
    chip.onclick = () => {
      statusDiv.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      chip.classList.add('on');
    };
    statusDiv.appendChild(chip);
  });

  // Stat effect frame (key-value number rows)
  renderKeyValueRows('edit-stats', scroll.stat_effect_frame || {}, SCROLL_STAT_KEYS, 'stat');

  // Target item ID and max applications
  document.getElementById('edit-targetItemId').value = scroll.target_item_id ?? '';
  document.getElementById('edit-maxApps').value = scroll.max_applications ?? '';
}
```

- [ ] **Step 2: Add `SCROLL_STAT_KEYS` constant**

In the Config section (after `STAT_KEYS` on line 558), add:

```js
const SCROLL_STAT_KEYS = ['str','dex','int','luk','maxHp','maxMp','weaponAttack','magicAttack','weaponDefense','magicDefense','accuracy','avoidability','speed','jump','attackSpeed'];
```

- [ ] **Step 3: Replace edit modal HTML to support both types**

Replace the Edit Modal HTML section (lines 794-831) with:

```html
<!-- Edit Modal -->
<div class="modal-overlay hidden" id="edit-modal">
  <div class="modal-box">
    <h2 id="edit-title">Edit Item</h2>
    <div id="edit-spinner" class="loading"><div class="spinner"></div><div>Fetching...</div></div>
    <div id="edit-form" style="display:none">
      <div class="modal-row">
        <div class="modal-field"><label>Name KO</label><input id="edit-nameKo"></div>
        <div class="modal-field" id="edit-nameEn-group"><label>Name EN</label><input id="edit-nameEn"></div>
      </div>
      <div class="modal-row">
        <div class="modal-field" id="edit-kind-group"><label>Equipment Kind</label><select id="edit-kind"></select></div>
        <div class="modal-field" id="edit-category-group" style="display:none"><label>Category</label><select id="edit-category"></select></div>
        <div class="modal-field" id="edit-level-group"><label>Level</label><input type="number" id="edit-level" min="0"></div>
      </div>
      <div class="modal-field" id="edit-jobs-group">
        <label>Jobs</label>
        <div class="chips-row" id="edit-jobs"></div>
      </div>
      <div class="modal-field" id="edit-behavior-group" style="display:none">
        <label>Behavior Type</label>
        <div class="chips-row" id="edit-behavior"></div>
      </div>
      <div class="modal-field">
        <label>Status</label>
        <div class="chips-row" id="edit-status"></div>
      </div>
      <div class="modal-field">
        <label id="edit-stats-label">Stats <button type="button" onclick="addStatRow()" style="font-size:0.7rem;padding:2px 8px;cursor:pointer">+ Add</button></label>
        <div id="edit-stats"></div>
      </div>
      <div class="modal-field" id="edit-reqs-group">
        <label>Requirements <button type="button" onclick="addReqRow()" style="font-size:0.7rem;padding:2px 8px;cursor:pointer">+ Add</button></label>
        <div id="edit-reqs"></div>
      </div>
      <div class="modal-field" id="edit-aliases-group">
        <label id="edit-aliases-label">Aliases (comma-separated)</label>
        <input id="edit-aliases">
      </div>
      <div class="modal-row" id="edit-scroll-extra-group" style="display:none">
        <div class="modal-field"><label>Target Item ID</label><input type="number" id="edit-targetItemId"></div>
        <div class="modal-field"><label>Max Applications</label><input type="number" id="edit-maxApps"></div>
      </div>
      <div class="modal-actions">
        <button class="btn-cancel" onclick="closeModal()">Cancel</button>
        <button class="btn-save" id="btn-save" onclick="saveItem()">Save Changes</button>
      </div>
      <div class="modal-feedback" id="edit-feedback"></div>
    </div>
  </div>
</div>
```

- [ ] **Step 4: Update `openEdit` to show/hide type-specific form fields**

Replace the `openEdit` function (lines 594-615) with:

```js
async function openEdit(itemId) {
  ensureKey(() => openEdit(itemId));
  if (!getEditKey()) return;
  editingItemId = itemId;
  document.getElementById('edit-modal').classList.remove('hidden');
  document.getElementById('edit-form').style.display = 'none';
  document.getElementById('edit-spinner').style.display = 'block';
  document.getElementById('edit-feedback').className = 'modal-feedback';
  document.getElementById('edit-title').textContent = activeType === 'equipment' ? 'Edit Item #' + itemId : 'Edit Scroll';

  // Show/hide type-specific fields
  const isEquip = activeType === 'equipment';
  document.getElementById('edit-nameEn-group').style.display = isEquip ? '' : 'none';
  document.getElementById('edit-kind-group').style.display = isEquip ? '' : 'none';
  document.getElementById('edit-category-group').style.display = isEquip ? 'none' : '';
  document.getElementById('edit-level-group').style.display = isEquip ? '' : 'none';
  document.getElementById('edit-jobs-group').style.display = isEquip ? '' : 'none';
  document.getElementById('edit-behavior-group').style.display = isEquip ? 'none' : '';
  document.getElementById('edit-reqs-group').style.display = isEquip ? '' : 'none';
  document.getElementById('edit-scroll-extra-group').style.display = isEquip ? 'none' : '';
  document.getElementById('edit-aliases-label').textContent = isEquip ? 'Aliases (comma-separated)' : 'Affected Stats (comma-separated)';
  document.getElementById('edit-stats-label').innerHTML = (isEquip ? 'Stats' : 'Stat Effect Frame') +
    ' <button type="button" onclick="addStatRow()" style="font-size:0.7rem;padding:2px 8px;cursor:pointer">+ Add</button>';

  const table = activeType === 'equipment' ? 'item_definitions' : 'scroll_definitions';
  const col = activeType === 'equipment' ? 'id' : 'id';
  const op = activeType === 'equipment' ? 'eq.' : 'eq.';

  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/' + table + '?id=' + op + itemId + '&limit=1', {
      headers: { apikey: getEditKey(), authorization: 'Bearer ' + getEditKey() }
    });
    if (!res.ok) throw new Error('Fetch failed: ' + res.status);
    const data = await res.json();
    if (!data.length) throw new Error('Not found');
    populateForm(data[0]);
  } catch (e) {
    document.getElementById('edit-spinner').innerHTML = '<div class="error-msg">Failed to fetch: ' + e.message + '</div>';
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add outputs/item-review.template.html
git commit -m "feat: add scroll edit modal with type-aware form fields

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: Add scroll save logic

**Files:**
- Modify: `outputs/item-review.template.html`

- [ ] **Step 1: Replace `saveItem` with type-aware version**

Replace the `saveItem` function (lines 715-778) with:

```js
async function saveItem() {
  const fb = document.getElementById('edit-feedback');
  fb.className = 'modal-feedback';
  const btn = document.getElementById('btn-save');
  btn.disabled = true; btn.textContent = 'Saving...';

  if (activeType === 'equipment') {
    await saveEquipmentItem(fb, btn);
  } else {
    await saveScrollItem(fb, btn);
  }

  btn.disabled = false; btn.textContent = 'Save Changes';
}

async function saveEquipmentItem(fb, btn) {
  const jobs = [];
  document.querySelectorAll('#edit-jobs .chip.on').forEach(c => jobs.push(JOB_LABELS[c.textContent] ? [...EDITABLE_JOB_KEYS].find(j => JOB_LABELS[j] === c.textContent) : c.textContent));
  const statusChip = document.querySelector('#edit-status .chip.on');
  const statusVal = statusChip ? statusChip.dataset.value : 'published';

  const buildObj = (prefix) => {
    const obj = {};
    document.querySelectorAll('[data-prefix="' + prefix + '"]').forEach(input => {
      const val = Number(input.value);
      if (Number.isFinite(val)) obj[input.dataset.key] = val;
    });
    return obj;
  };

  const aliasesRaw = document.getElementById('edit-aliases').value.trim();
  const aliases = aliasesRaw ? aliasesRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const patch = {
    name_ko: document.getElementById('edit-nameKo').value.trim(),
    name_en: document.getElementById('edit-nameEn').value.trim(),
    equipment_kind: document.getElementById('edit-kind').value,
    required_level: parseInt(document.getElementById('edit-level').value) || 0,
    required_jobs: jobs,
    published_status: statusVal,
    stats: buildObj('stat'),
    requirements: buildObj('req'),
    aliases: aliases,
  };

  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/item_definitions?id=eq.' + editingItemId, {
      method: 'PATCH',
      headers: { apikey: getEditKey(), authorization: 'Bearer ' + getEditKey(), 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) { const b = await res.text(); throw new Error(b); }

    const idx = allItems.findIndex(i => i.id === editingItemId);
    if (idx >= 0) {
      allItems[idx] = { ...allItems[idx],
        nameKo: patch.name_ko, nameEn: patch.name_en, equipmentKind: patch.equipment_kind,
        requiredLevel: patch.required_level, requiredJobs: patch.required_jobs,
        publishedStatus: patch.published_status, stats: patch.stats, requirements: patch.requirements,
        aliases: patch.aliases
      };
    }

    closeModal();
    showToast('Item #' + editingItemId + ' saved ✓', 'ok');
    renderSummary(); renderTable();
  } catch (e) {
    fb.className = 'modal-feedback err';
    fb.textContent = 'Save failed: ' + e.message;
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}

async function saveScrollItem(fb, btn) {
  // Behavior type
  const btChip = document.querySelector('#edit-behavior .chip.on');
  const behaviorVal = btChip ? btChip.dataset.value : 'fixed';

  // Status
  const statusChip = document.querySelector('#edit-status .chip.on');
  const statusVal = statusChip ? statusChip.dataset.value : 'published';

  // Stat effect frame (key-value)
  const stats = {};
  document.querySelectorAll('#edit-stats [data-prefix="stat"]').forEach(input => {
    const val = Number(input.value);
    if (Number.isFinite(val)) stats[input.dataset.key] = val;
  });

  // Affected stats (comma-separated text -> array)
  const affectedRaw = document.getElementById('edit-aliases').value.trim();
  const affectedStats = affectedRaw ? affectedRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const patch = {
    name_ko: document.getElementById('edit-nameKo').value.trim(),
    category: document.getElementById('edit-category').value,
    behavior_type: behaviorVal,
    published_status: statusVal,
    stat_effect_frame: stats,
    affected_stats: affectedStats,
    target_item_id: parseInt(document.getElementById('edit-targetItemId').value) || null,
    max_applications: parseInt(document.getElementById('edit-maxApps').value) || null,
  };

  try {
    const res = await fetch(SUPABASE_URL + '/rest/v1/scroll_definitions?id=eq.' + editingItemId, {
      method: 'PATCH',
      headers: { apikey: getEditKey(), authorization: 'Bearer ' + getEditKey(), 'content-type': 'application/json', prefer: 'return=minimal' },
      body: JSON.stringify(patch)
    });
    if (!res.ok) { const b = await res.text(); throw new Error(b); }

    // Update embedded data
    const idx = allScrolls.findIndex(s => s.id === editingItemId);
    if (idx >= 0) {
      allScrolls[idx] = { ...allScrolls[idx],
        nameKo: patch.name_ko, category: patch.category,
        behaviorType: patch.behavior_type, publishedStatus: patch.published_status,
        stats: patch.stat_effect_frame, affectedStats: patch.affected_stats,
        targetItemId: patch.target_item_id, maxApplications: patch.max_applications
      };
    }

    closeModal();
    showToast('Scroll saved ✓', 'ok');
    renderSummary(); renderTable();
  } catch (e) {
    fb.className = 'modal-feedback err';
    fb.textContent = 'Save failed: ' + e.message;
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
}
```

- [ ] **Step 2: Update `editingItemId` variable comment to reflect dual use**

No code change needed — `editingItemId` already works for both numeric item IDs and UUID scroll IDs since it's always used as a string.

- [ ] **Step 3: Commit**

```bash
git add outputs/item-review.template.html
git commit -m "feat: add scroll save logic with PATCH to scroll_definitions table

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: End-to-end verification

- [ ] **Step 1: Regenerate the dashboard**

Run: `npm run generate:item-review`
Expected: Console shows both item and scroll fetch counts, generates without errors.

- [ ] **Step 2: Verify both datasets are embedded in the output**

Run: `head -c 500 outputs/item-review.html | grep -o 'window\.__[A-Z_]*__'`
Expected: Output shows both `window.__ITEM_DATA__` and `window.__SCROLL_DATA__`.

- [ ] **Step 3: Run existing tests to confirm no regressions**

Run: `node --test tests/scroll-status-review.test.mjs`
Expected: All 7 tests pass.

- [ ] **Step 4: Verify the generated HTML is valid**

Run: `node -e "const fs = require('fs'); const html = fs.readFileSync('outputs/item-review.html','utf8'); console.log('HTML size:', (html.length / 1024 / 1024).toFixed(2), 'MB'); console.log('Has ITEM_DATA:', html.includes('window.__ITEM_DATA__')); console.log('Has SCROLL_DATA:', html.includes('window.__SCROLL_DATA__')); console.log('Has type toggle:', html.includes('switchType')); console.log('Has scroll table:', html.includes('renderScrollRow')); console.log('Has scroll save:', html.includes('saveScrollItem'));"`
Expected: All checks return true.

- [ ] **Step 5: Commit final verification**

```bash
git add outputs/item-review.html
git commit -m "chore: regenerate item review dashboard with scroll data

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Post-Implementation Manual QA

After all tasks are complete, open `outputs/item-review.html` in a browser and verify:
1. **Equipment tab** (default) — all existing functionality works unchanged (filters, sorting, edit, CSV export)
2. **Click "Scrolls" tab** — table switches to scroll columns (Icon, ID, Name KO, Category, Behavior, Affected Stats, Status, Edit)
3. **Scroll filters** — Category dropdown, Behavior chips, Status chips, Korean Name chips, Has Stats chips all filter correctly
4. **Scroll sorting** — click ID, Name KO, Category, Status column headers to sort
5. **Scroll edit** — click ✏️ on a scroll row, edit fields show (Name KO, Category dropdown, Behavior Type chips, Status chips, Stat Effect Frame key-value rows, Affected Stats comma text, Target Item ID, Max Applications), save works
6. **CSV export** — exports scroll data with correct columns
7. **Switch back to Equipment** — all equipment functionality still works
