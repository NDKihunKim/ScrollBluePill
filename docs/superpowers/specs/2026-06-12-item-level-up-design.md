# Item Level-Up Design

**Date:** 2026-06-12  
**Status:** Approved  
**Source:** [옛날메이플 메이커 정보 (리버스와 타임리스)](https://maplekibun.tistory.com/762)

## Goal

Add an `아이템 레벨업` enhancement feature for Reverse and Timeless items. The feature lets users manually enter item level-up stat outcomes within source-defined ranges, using the same outcome-entry style as chaos scrolls and special Maker gems.

Reverse items support 3 item level-up slots. Timeless items support 5 item level-up slots.

## Non-Goals

- Do not roll random level-up outcomes.
- Do not track `최종 레벨 도달 시` skill bonuses.
- Do not fetch or parse the source article in the browser.
- Do not treat item level-up as consuming scroll upgrade slots.
- Do not clear item level-up data when Maker is toggled off.

## Data Pipeline

Use the same source-to-static-runtime pattern as items and scrolls:

```text
curated repo seed JSON
  -> Supabase item_level_up_definitions
  -> generate runtime JSON
  -> frontend loads static JSON
```

### Repo Seed

Add a reviewed seed file such as:

```text
data/item-level-up-definitions.seed.json
```

This file stores normalized definitions from the article. It is the reviewable source for pull requests and future data updates.

Use a hybrid model:

- item definitions are keyed by item ID
- repeated stat ranges may reference shared templates
- templates are used only when ranges are exactly identical
- every supported item has an explicit item entry

### Supabase

Add a table similar to:

```sql
create table public.item_level_up_definitions (
  item_id integer primary key references public.item_definitions(id),
  version_tag_id uuid not null references public.version_tags(id),
  level_up_kind text not null check (level_up_kind in ('reverse', 'timeless')),
  max_level_ups integer not null check (max_level_ups in (3, 5)),
  template_key text,
  stat_ranges jsonb not null,
  source_name_ko text not null,
  source_url text not null,
  source_note text,
  published_status text not null default 'draft'
    check (published_status in ('draft', 'published', 'hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Enable RLS and expose only published rows for public reads:

```sql
alter table public.item_level_up_definitions enable row level security;

create policy "Public can read published item level-up definitions"
on public.item_level_up_definitions
for select
using (published_status = 'published');
```

The seed script should use the service role key to upsert rows from the repo seed file.

### Runtime JSON

Add a generate script that reads published Supabase rows and writes:

```text
public/data/item-level-ups-gms83-ko.json
```

The browser uses this generated static file. Runtime lookup is by selected item ID. If no definition exists for the selected item ID, the UI does not show the `아이템 레벨업` button.

## Data Normalization

Normalize source stat labels to existing internal stat keys:

| Source label | Internal key |
| --- | --- |
| `물리공격력`, `공격력` | `weaponAttack` |
| `마법공격력`, `마력` | `magicAttack` |
| `물리방어력` | `weaponDefense` |
| `마법방어력` | `magicDefense` |
| `명중률` | `accuracy` |
| `회피율` | `avoidability` |
| `이동속도` | `speed` |
| `점프력` | `jump` |
| `HP` | `maxHp` |
| `MP` | `maxMp` |
| `STR` | `str` |
| `DEX` | `dex` |
| `INT` | `int` |
| `LUK` | `luk` |

Ranges like `+0~2` become:

```json
{ "min": 0, "max": 2 }
```

Fixed values use the same shape with equal min and max.

## UI

Add an `아이템 레벨업` button to the right of `메이커` in the enhancement panel control row.

Visibility:

- show only when the selected item has a runtime level-up definition
- hide for unsupported items
- keep independent from Maker active/inactive state

Panel behavior:

- Reverse items render `Lv 1`, `Lv 2`, `Lv 3`
- Timeless items render `Lv 1` through `Lv 5`
- empty level slots are clickable
- filled level slots show compact stat summaries
- each filled slot has an `x` affordance to clear only that slot
- clicking a slot opens an editor below the slot row

The editor uses familiar bounded stat rows:

```text
label | MIN | - | value | + | MAX
```

Each row clamps to the definition's range for that stat. Clicking `적용` saves the current level slot and auto-advances to the next empty slot. After the final slot is applied, keep the filled slot row visible and hide only the input editor.

No whole-panel preset buttons are included.

## State Model

Extend enhancement state with item level-up slots, separate from Maker slots:

```js
itemLevelUpSlots: [
  { stats: { ... } } | null
]
```

Slot count comes from the runtime definition:

- Reverse: 3
- Timeless: 5
- unsupported: 0

Lifecycle:

- changing selected item recreates item level-up slots
- full enhancement reset clears item level-up slots
- Maker toggle off does not clear item level-up slots
- scroll slot revert does not clear item level-up slots
- item level-up does not consume upgrade slots

## Stat Computation

`computeAccumulatedStats()` includes item level-up slot stats.

`computeGradeColor()` includes item level-up gains.

Chaos and special-gem panels that use accumulated stats can see item level-up gains when determining eligible stat rows.

## Item Card Breakdown

Item level-up is state-independent from Maker but displays inside the existing Maker contribution bucket.

The item card remains:

```text
기본 + 메이커 + 주문서
```

`메이커` includes:

- Maker gems
- Maker stimulant
- item level-up gains

Example:

```text
STR 120 (100 + 12 + 8)
```

Here `12` is Maker gems/stimulant plus item level-up, and `8` is scroll contribution.

## Testing

Use test-first implementation.

Data tests:

- seed JSON parses
- every `item_id` exists in current item data
- Reverse definitions have `max_level_ups: 3`
- Timeless definitions have `max_level_ups: 5`
- every `stat_ranges` key is known
- every range has finite `min <= max`

Supabase/schema tests:

- `supabase/schema.sql` defines `item_level_up_definitions`
- RLS is enabled
- public read policy is restricted to `published_status = 'published'`
- service role has enough access for seed upserts

State tests:

- item level-up slots initialize only when a definition is present
- applying a level-up slot contributes to accumulated stats
- item level-up contributes to the `maker` breakdown bucket
- Maker deactivation does not clear item level-up slots
- reset and item change clear item level-up slots

UI/source contract tests:

- `아이템 레벨업` button is rendered beside `메이커`
- button only appears for selected items with level-up data
- slot count is 3 or 5
- input rows clamp to min/max
- apply auto-advances to the next empty slot

Verification:

- run focused Node tests
- run `npm run build`
- manually test at least one Reverse item and one Timeless item in the app
