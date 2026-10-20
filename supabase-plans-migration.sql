create table if not exists public.property_plans (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  name text not null,
  floor_label text,
  source_type text not null check (source_type in ('pdf', 'dxf')),
  file_path text not null unique,
  file_name text not null,
  page_number integer not null default 1 check (page_number > 0),
  source_width numeric,
  source_height numeric,
  meters_per_unit numeric check (meters_per_unit is null or meters_per_unit > 0),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.property_units (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  plan_id uuid not null references public.property_plans(id) on delete cascade,
  property_type text not null check (property_type in ('Lote', 'Casa', 'Departamento')),
  code text not null,
  block text,
  address text,
  location_label text,
  building text,
  tower text,
  floor_label text,
  area_land_m2 numeric check (area_land_m2 is null or area_land_m2 >= 0),
  area_total_m2 numeric check (area_total_m2 is null or area_total_m2 >= 0),
  area_covered_m2 numeric check (area_covered_m2 is null or area_covered_m2 >= 0),
  other_areas_m2 numeric check (other_areas_m2 is null or other_areas_m2 >= 0),
  frontage_m numeric check (frontage_m is null or frontage_m >= 0),
  back_m numeric check (back_m is null or back_m >= 0),
  side_a_m numeric check (side_a_m is null or side_a_m >= 0),
  side_b_m numeric check (side_b_m is null or side_b_m >= 0),
  floors integer check (floors is null or floors >= 0),
  bedrooms integer check (bedrooms is null or bedrooms >= 0),
  bathrooms integer check (bathrooms is null or bathrooms >= 0),
  status text not null default 'available' check (status in ('available', 'reserved', 'sold')),
  price numeric check (price is null or price >= 0),
  observations text,
  geometry jsonb not null default '{"type":"Polygon","coordinates":[]}'::jsonb
    check (jsonb_typeof(geometry) = 'object'),
  created_by uuid references auth.users(id),
  updated_at timestamptz not null default now(),
  unique (plan_id, property_type, code)
);

alter table public.property_units
  alter column status set default 'unknown';
alter table public.property_units
  drop constraint if exists property_units_status_check;
alter table public.property_units
  add constraint property_units_status_check
    check (status in ('available', 'reserved', 'sold', 'blocked', 'unknown'));

create table if not exists public.property_unit_owners (
  property_id uuid primary key references public.property_units(id) on delete cascade,
  owner text not null,
  updated_at timestamptz not null default now()
);

create index if not exists property_plans_project_id_idx
  on public.property_plans (project_id, created_at);
create index if not exists property_units_project_id_idx
  on public.property_units (project_id, plan_id, code);

create or replace function public.touch_property_unit_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists property_units_touch_updated_at on public.property_units;
create trigger property_units_touch_updated_at
  before update on public.property_units
  for each row execute function public.touch_property_unit_updated_at();

drop trigger if exists property_unit_owners_touch_updated_at on public.property_unit_owners;
create trigger property_unit_owners_touch_updated_at
  before update on public.property_unit_owners
  for each row execute function public.touch_property_unit_updated_at();

alter table public.property_plans enable row level security;
alter table public.property_units enable row level security;
alter table public.property_unit_owners enable row level security;

drop policy if exists "Property plans are publicly readable" on public.property_plans;
create policy "Property plans are publicly readable"
  on public.property_plans for select using (true);
drop policy if exists "Admins can manage property plans" on public.property_plans;
create policy "Admins can manage property plans"
  on public.property_plans for all to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));

drop policy if exists "Property units are publicly readable" on public.property_units;
create policy "Property units are publicly readable"
  on public.property_units for select using (true);
drop policy if exists "Admins can manage property units" on public.property_units;
create policy "Admins can manage property units"
  on public.property_units for all to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));

drop policy if exists "Only admins can read property owners" on public.property_unit_owners;
create policy "Only admins can read property owners"
  on public.property_unit_owners for select to authenticated
  using ((select public.is_project_admin()));
drop policy if exists "Only admins can manage property owners" on public.property_unit_owners;
create policy "Only admins can manage property owners"
  on public.property_unit_owners for all to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));

grant select on public.property_plans, public.property_units to anon, authenticated;
grant insert, update, delete on public.property_plans, public.property_units to authenticated;
grant select, insert, update, delete on public.property_unit_owners to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  true,
  26214400,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif',
    'application/pdf', 'application/dxf', 'application/x-dxf', 'image/vnd.dxf'
  ]
)
on conflict (id) do update
set allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Plans are publicly readable" on storage.objects;
create policy "Plans are publicly readable"
  on storage.objects for select using (bucket_id = 'project-files');
drop policy if exists "Admins can upload project files" on storage.objects;
create policy "Admins can upload project files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and (select public.is_project_admin()));
drop policy if exists "Admins can delete project files" on storage.objects;
create policy "Admins can delete project files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (select public.is_project_admin()));
