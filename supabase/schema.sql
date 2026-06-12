create table if not exists public.version_tags (
	id uuid primary key default gen_random_uuid(),
	label_ko text not null,
	label_en text,
	data_date date,
	description text,
	is_active boolean not null default true,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.scroll_definitions (
	id uuid primary key default gen_random_uuid(),
	version_tag_id uuid not null references public.version_tags(id),
	name_ko text not null,
	category text not null,
	behavior_type text not null check (behavior_type in ('fixed', 'random', 'unknown')),
	published_status text not null default 'draft' check (published_status in ('draft', 'published', 'hidden')),
	affected_stats text[] not null default '{}',
	stat_effect_frame jsonb not null default '{}'::jsonb,
	source_note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Backfill: column already exists in live DB but was missing from schema.sql
alter table public.scroll_definitions
	add column if not exists maplestory_io_item_id integer;

-- Item-specific scroll targeting (NULL = works on all items of the category)
alter table public.scroll_definitions
	add column if not exists target_item_id integer;

-- Maximum times this scroll can be applied to a single item (NULL = unlimited)
alter table public.scroll_definitions
	add column if not exists max_applications integer;

create table if not exists public.item_categories (
	id uuid primary key default gen_random_uuid(),
	version_tag_id uuid not null references public.version_tags(id),
	name_ko text not null,
	stat_groups text[] not null default '{}',
	default_slot_frame jsonb not null default '{}'::jsonb,
	source_note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.probability_sets (
	id uuid primary key default gen_random_uuid(),
	version_tag_id uuid not null references public.version_tags(id),
	scroll_definition_id uuid references public.scroll_definitions(id),
	model_type text not null,
	raw_config jsonb not null default '{}'::jsonb,
	validation_status text not null default 'draft' check (
		validation_status in ('draft', 'reviewed', 'verified')
	),
	source_note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create table if not exists public.guide_content (
	id uuid primary key default gen_random_uuid(),
	title_ko text not null,
	slug text not null unique,
	summary_ko text not null,
	body_frame jsonb not null default '{}'::jsonb,
	seo_title_ko text not null,
	seo_description_ko text not null,
	published_status text not null default 'draft' check (
		published_status in ('draft', 'published')
	),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

alter table public.version_tags enable row level security;
alter table public.scroll_definitions enable row level security;
alter table public.item_categories enable row level security;
alter table public.probability_sets enable row level security;
alter table public.guide_content enable row level security;

-- RLS: only published scrolls are visible to the public anon role
create policy "Public can read published scrolls" on public.scroll_definitions
	for select using (published_status = 'published');

grant select on public.scroll_definitions to service_role;
grant update (published_status, name_ko, affected_stats, behavior_type, maplestory_io_item_id, target_item_id, max_applications) on public.scroll_definitions to service_role;

-- Migration for existing scroll_definitions tables that lack published_status
alter table public.scroll_definitions
	add column if not exists published_status text not null default 'draft';

alter table public.scroll_definitions
	add constraint scroll_definitions_published_status_check
	check (published_status in ('draft', 'published', 'hidden'));

create table if not exists public.item_definitions (
    id integer primary key,
    version_tag_id uuid not null references public.version_tags(id),
    name_ko text not null,
    name_en text,
    equipment_kind text not null,
    required_level integer not null default 0,
    required_jobs text[] not null default '{}',
    requirements jsonb not null default '{}'::jsonb,
    stats jsonb not null default '{}'::jsonb,
    aliases text[] not null default '{}',
    published_status text not null default 'draft'
        check (published_status in ('draft', 'published', 'hidden')),
    source_note text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

alter table public.item_definitions enable row level security;

create policy "Public can read published items" on public.item_definitions
    for select using (published_status = 'published');

-- Expose item_definitions to the Data API
grant select on public.item_definitions to anon, authenticated;
grant select, insert, update, delete on public.item_definitions to service_role;

create table if not exists public.item_level_up_definitions (
    item_id integer primary key references public.item_definitions(id),
    version_tag_id uuid not null references public.version_tags(id),
    level_up_kind text not null check (level_up_kind in ('reverse', 'timeless')),
    max_level_ups integer not null check (max_level_ups in (3, 5)),
    template_key text,
    stat_ranges jsonb not null default '{}'::jsonb,
    source_name_ko text not null,
    source_url text not null,
    source_note text,
    published_status text not null default 'draft'
        check (published_status in ('draft', 'published', 'hidden')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint item_level_up_definitions_kind_max_level_ups_check
        check (
            (level_up_kind = 'reverse' and max_level_ups = 3)
            or (level_up_kind = 'timeless' and max_level_ups = 5)
        )
);

-- Backfill: schema.sql may rerun after this table already exists without the constraint.
do $$
begin
    alter table public.item_level_up_definitions
        add constraint item_level_up_definitions_kind_max_level_ups_check
        check (
            (level_up_kind = 'reverse' and max_level_ups = 3)
            or (level_up_kind = 'timeless' and max_level_ups = 5)
        );
exception
    when duplicate_object then null;
end $$;

alter table public.item_level_up_definitions enable row level security;

create policy "Public can read published item level-up definitions"
on public.item_level_up_definitions
for select
using (
    published_status = 'published'
    and exists (
        select 1
        from public.item_definitions
        where item_definitions.id = item_level_up_definitions.item_id
        and item_definitions.published_status = 'published'
    )
);

grant select on public.item_level_up_definitions to anon, authenticated;
grant select, insert, update, delete on public.item_level_up_definitions to service_role;
