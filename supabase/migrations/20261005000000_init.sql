-- Terroa — initial schema (HANDOFF.md section 11).
-- Applied to the dedicated Terroa Supabase project (ca-central-1) on 2026-10-05. No shared data or keys.

create extension if not exists pgcrypto;

-- Catalogue -----------------------------------------------------------------
create table public.categories (
  id text primary key,
  slug_fr text not null unique,
  slug_en text not null unique,
  name_fr text not null,
  name_en text not null,
  parent_id text references public.categories(id),
  sort int not null default 0,
  published boolean not null default false
);

create table public.products (
  id text primary key,
  category_id text not null references public.categories(id),
  kind text not null check (kind in ('floor', 'panel', 'accessory')),
  slug_fr text not null unique,
  slug_en text not null unique,
  name_fr text not null,
  name_en text not null,
  collection text,
  tone text,
  attributes jsonb not null default '{}'::jsonb,
  coverage_sqft_per_box numeric check (coverage_sqft_per_box > 0),
  panel_width_in numeric check (panel_width_in > 0),
  panel_height_in numeric check (panel_height_in > 0),
  price_mode text not null default 'hidden' check (price_mode in ('hidden', 'from', 'exact')),
  price_cad numeric check (price_cad >= 0),
  published boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  documents jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title_fr text not null,
  title_en text not null,
  city text,
  year int,
  type text not null check (type in ('residential', 'commercial', 'office')),
  description_fr text,
  description_en text,
  credits jsonb not null default '{}'::jsonb,
  consent_on_file boolean not null default false,
  published boolean not null default false,
  images jsonb not null default '[]'::jsonb
);

create table public.project_products (
  project_id uuid not null references public.projects(id) on delete cascade,
  product_id text not null references public.products(id) on delete cascade,
  primary key (project_id, product_id)
);

-- Quotes (no public access; inserts only through the server with the service role) -------
create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique,
  status text not null default 'new' check (status in ('new', 'in_progress', 'quoted', 'closed')),
  locale text not null check (locale in ('fr', 'en')),
  project_name text,
  project_type text,
  site_city text not null,
  start_window text,
  reception text check (reception in ('delivery', 'pickup')),
  notes text check (char_length(notes) <= 2000),
  contact_name text not null,
  contact_email text not null,
  contact_company text,
  contact_phone text,
  contact_role text,
  marketing_opt_in boolean not null default false,
  marketing_opt_in_at timestamptz,
  notice_version text not null,
  idempotency_key text unique check (char_length(idempotency_key) between 16 and 64),
  created_at timestamptz not null default now(),
  retain_until timestamptz not null  -- set by the server from the retention period Terroa chooses
);

create table public.quote_items (
  id uuid primary key default gen_random_uuid(),
  quote_request_id uuid not null references public.quote_requests(id) on delete cascade,
  product_id text,  -- catalogue id at quote time; no FK so quotes survive catalogue changes
  product_snapshot jsonb not null,
  quantity int not null check (quantity between 1 and 9999),
  unit text not null check (unit in ('box', 'panel', 'area')),
  rooms text[] not null default '{}',
  planned_area_sqft numeric check (planned_area_sqft > 0)
);

create table public.plan_uploads (
  id uuid primary key default gen_random_uuid(),
  upload_token_hash text not null,
  quote_request_id uuid references public.quote_requests(id) on delete set null,
  storage_path text not null,
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png')),
  bytes int not null check (bytes <= 20 * 1024 * 1024),
  pages int check (pages between 1 and 10),
  status text not null default 'uploaded' check (status in ('uploaded', 'analysing', 'done', 'failed', 'deleted')),
  extraction jsonb,
  model text,
  created_at timestamptz not null default now(),
  delete_after timestamptz not null,
  deleted_at timestamptz
);

create index on public.quote_items (quote_request_id);
create index on public.plan_uploads (delete_after) where deleted_at is null;
create index on public.quote_requests (retain_until);
create index on public.products (category_id);
create index on public.project_products (product_id);
create index on public.categories (parent_id);
create index on public.plan_uploads (quote_request_id);

-- Row level security: ON for every table -------------------------------------------------
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.projects enable row level security;
alter table public.project_products enable row level security;
alter table public.quote_requests enable row level security;
alter table public.quote_items enable row level security;
alter table public.plan_uploads enable row level security;

-- Anonymous visitors: published catalogue rows only; projects only with consent on file.
create policy "public read published categories" on public.categories for select to anon, authenticated using (published);
create policy "public read published products" on public.products for select to anon, authenticated using (published);
create policy "public read consented projects" on public.projects for select to anon, authenticated using (published and consent_on_file);
create policy "public read project products" on public.project_products for select to anon, authenticated
  using (exists (select 1 from public.projects p where p.id = project_id and p.published and p.consent_on_file)
     and exists (select 1 from public.products pr where pr.id = product_id and pr.published));

-- Staff: Supabase Auth with app_metadata.role = 'staff' (MFA enforced in the Auth settings).
create function public.is_staff() returns boolean language sql stable set search_path = '' as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'staff', false)
$$;

create policy "staff manage categories" on public.categories for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage products" on public.products for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage projects" on public.projects for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff manage project products" on public.project_products for all to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff read quotes" on public.quote_requests for select to authenticated using (public.is_staff());
create policy "staff update quotes" on public.quote_requests for update to authenticated using (public.is_staff()) with check (public.is_staff());
create policy "staff read quote items" on public.quote_items for select to authenticated using (public.is_staff());
create policy "staff read plans" on public.plan_uploads for select to authenticated using (public.is_staff());
-- No policy grants anon any access to quote_requests, quote_items or plan_uploads: default deny.
-- The server writes with the service role (bypasses RLS) after zod validation; never expose that key to the browser.

-- Storage buckets ---------------------------------------------------------------------
-- product-media: public read (public bucket), writes only by staff/service role.
-- plans: PRIVATE, no public URLs, no policies for anon/authenticated: signed upload URLs and server reads only.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-media', 'product-media', true, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('plans', 'plans', false, 20971520, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;
