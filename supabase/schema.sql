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
	maplestory_io_item_id integer unique,
	source_note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

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

-- RLS: anon can read active version tags
create policy "Public can read version tags" on public.version_tags
	for select using (is_active = true);

-- RLS: anon can insert/update scroll definitions (seed script)
create policy "Public can insert scroll definitions" on public.scroll_definitions
	for insert with check (true);

create policy "Public can update scroll definitions" on public.scroll_definitions
	for update using (true) with check (true);

-- RLS: only published scrolls are visible to the public anon role
create policy "Public can read published scrolls" on public.scroll_definitions
	for select using (published_status = 'published');

-- Migration for existing scroll_definitions tables that lack newer columns
alter table public.scroll_definitions
	add column if not exists published_status text not null default 'draft';

alter table public.scroll_definitions
	add column if not exists maplestory_io_item_id integer;

alter table public.scroll_definitions
	add constraint scroll_definitions_published_status_check
	check (published_status in ('draft', 'published', 'hidden'));
