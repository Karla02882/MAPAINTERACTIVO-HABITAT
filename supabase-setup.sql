create extension if not exists pgcrypto;

create table if not exists public.projects (
  id text primary key,
  name text not null,
  project_type text not null check (
    project_type in ('Departamentos', 'Lotes', 'Casa de campo', 'Casas', 'Oficinas')
  )
);

insert into public.projects (id, name, project_type) values
  ('san-antonio', 'SAN ANTONIO', 'Departamentos'),
  ('aguirre-619', 'AGUIRRE 619', 'Departamentos'),
  ('torre-blanca', 'TORRE BLANCA', 'Departamentos'),
  ('alameda', 'ALAMEDA', 'Departamentos'),
  ('jardines', 'JARDINES', 'Departamentos'),
  ('los-sauces', 'LOS SAUCES', 'Departamentos'),
  ('las-islas', 'LAS ISLAS', 'Departamentos'),
  ('lima-2', 'LIMA 2', 'Departamentos'),
  ('las-huertas-de-sicaya', 'LAS HUERTAS DE SICAYA', 'Lotes'),
  ('los-jardines-de-la-huaycha', 'LOS JARDINES DE LA HUAYCHA', 'Lotes'),
  ('la-pradera-de-quepepampa', 'LA PRADERA DE QUEPEPAMPA', 'Lotes'),
  ('la-libertad', 'LA LIBERTAD', 'Lotes'),
  ('el-trebol', 'EL TREBOL', 'Lotes'),
  ('san-isidro-v', 'SAN ISIDRO V', 'Casa de campo'),
  ('joya-verde', 'JOYA VERDE', 'Casa de campo'),
  ('magnolias', 'MAGNOLIAS', 'Oficinas'),
  ('habitat', 'HABITAT', 'Oficinas')
on conflict (id) do update
set name = excluded.name, project_type = excluded.project_type;

create table if not exists public.project_admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);

create or replace function public.is_project_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_admins
    where user_id = (select auth.uid())
  );
$$;

create table if not exists public.project_assets (
  id uuid primary key default gen_random_uuid(),
  project_id text not null references public.projects(id) on delete cascade,
  category text not null check (
    category in ('fachada', 'portico', 'areas_comunes', 'tipologia_departamento', 'documento')
  ),
  category_label text not null,
  file_path text not null unique,
  file_name text not null,
  mime_type text not null,
  is_primary boolean not null default false,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  check (not is_primary or mime_type like 'image/%'),
  check (category <> 'documento' or mime_type = 'application/pdf'),
  check (category = 'documento' or mime_type like 'image/%')
);

create or replace function public.set_project_primary_image(asset_uuid uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  selected_project_id text;
  selected_category text;
  selected_mime_type text;
  project_type_value text;
  required_category text;
begin
  if not public.is_project_admin() then
    raise exception 'Only project administrators can change the cover image';
  end if;

  select project_id, category, mime_type
    into selected_project_id, selected_category, selected_mime_type
  from public.project_assets
  where id = asset_uuid;

  if selected_project_id is null or selected_mime_type not like 'image/%' then
    raise exception 'The selected asset is not a project image';
  end if;

  select project_type into project_type_value
  from public.projects
  where id = selected_project_id;

  required_category := case
    when project_type_value in ('Lotes', 'Casa de campo') then 'portico'
    else 'fachada'
  end;

  if selected_category <> required_category then
    raise exception 'The cover image must be in the % category', required_category;
  end if;

  update public.project_assets
  set is_primary = false
  where project_id = selected_project_id and is_primary;

  update public.project_assets
  set is_primary = true
  where id = asset_uuid;
end;
$$;

create unique index if not exists project_assets_one_primary_image_per_project
  on public.project_assets (project_id)
  where is_primary;

alter table public.projects enable row level security;
alter table public.project_admins enable row level security;
alter table public.project_assets enable row level security;

drop policy if exists "Projects are publicly readable" on public.projects;
create policy "Projects are publicly readable"
  on public.projects for select
  using (true);

drop policy if exists "Admins can read their own admin record" on public.project_admins;
create policy "Admins can read their own admin record"
  on public.project_admins for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "Project assets are publicly readable" on public.project_assets;
create policy "Project assets are publicly readable"
  on public.project_assets for select
  using (true);

drop policy if exists "Admins can add project assets" on public.project_assets;
create policy "Admins can add project assets"
  on public.project_assets for insert to authenticated
  with check ((select public.is_project_admin()) and created_by = (select auth.uid()));

drop policy if exists "Admins can update project assets" on public.project_assets;
create policy "Admins can update project assets"
  on public.project_assets for update to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));

drop policy if exists "Admins can delete project assets" on public.project_assets;
create policy "Admins can delete project assets"
  on public.project_assets for delete to authenticated
  using ((select public.is_project_admin()));

grant select on public.projects, public.project_assets to anon, authenticated;
grant select on public.project_admins to authenticated;
grant insert, update, delete on public.project_assets to authenticated;
grant execute on function public.is_project_admin() to anon, authenticated;
grant execute on function public.set_project_primary_image(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
  true,
  26214400,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif', 'application/pdf']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Project files are publicly readable" on storage.objects;
create policy "Project files are publicly readable"
  on storage.objects for select
  using (bucket_id = 'project-files');

drop policy if exists "Admins can upload project files" on storage.objects;
create policy "Admins can upload project files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'project-files' and (select public.is_project_admin()));

drop policy if exists "Admins can update project files" on storage.objects;
create policy "Admins can update project files"
  on storage.objects for update to authenticated
  using (bucket_id = 'project-files' and (select public.is_project_admin()))
  with check (bucket_id = 'project-files' and (select public.is_project_admin()));

drop policy if exists "Admins can delete project files" on storage.objects;
create policy "Admins can delete project files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'project-files' and (select public.is_project_admin()));

-- In Supabase Auth, create staff accounts and disable public sign-ups.
-- Then authorize each account here:
-- insert into public.project_admins (user_id)
-- select id from auth.users where lower(email) in (
--   'habitatbr2@gmail.com',
--   '72128731@continental.edu.pe'
-- )
-- on conflict (user_id) do nothing;
