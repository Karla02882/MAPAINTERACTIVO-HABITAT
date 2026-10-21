create table if not exists public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 160),
  contact text check (contact is null or length(contact) <= 180),
  channel text not null check (
    channel in ('WhatsApp', 'Instagram', 'Facebook', 'Correo', 'Urbania', 'TikTok', 'Llamada')
  ),
  campaign text check (campaign is null or length(campaign) <= 180),
  project_interest text check (project_interest is null or length(project_interest) <= 180),
  budget text check (budget is null or length(budget) <= 100),
  stage text not null default 'Nuevo' check (
    stage in ('Nuevo', 'Contactado', 'Visita agendada', 'Negociación', 'Cerrado')
  ),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.crm_messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  sender text not null check (sender in ('lead', 'team')),
  body text not null check (length(trim(body)) between 1 and 4000),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.crm_leads(id) on delete cascade,
  description text not null check (length(trim(description)) between 1 and 300),
  due_date date not null,
  completed boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists crm_leads_stage_updated_idx
  on public.crm_leads (stage, updated_at desc);
create index if not exists crm_leads_assigned_updated_idx
  on public.crm_leads (assigned_to, updated_at desc);
create index if not exists crm_messages_lead_created_idx
  on public.crm_messages (lead_id, created_at);
create index if not exists crm_tasks_due_date_idx
  on public.crm_tasks (due_date, completed);
create index if not exists crm_tasks_lead_due_date_idx
  on public.crm_tasks (lead_id, due_date);

alter table public.crm_leads enable row level security;
alter table public.crm_messages enable row level security;
alter table public.crm_tasks enable row level security;

drop policy if exists "Project admins can manage CRM leads" on public.crm_leads;
drop policy if exists "Project admins can read CRM leads" on public.crm_leads;
drop policy if exists "Project admins can insert CRM leads" on public.crm_leads;
drop policy if exists "Project admins can update CRM leads" on public.crm_leads;
drop policy if exists "Project admins can delete CRM leads" on public.crm_leads;
create policy "Project admins can read CRM leads"
  on public.crm_leads for select to authenticated
  using ((select public.is_project_admin()))
;
create policy "Project admins can insert CRM leads"
  on public.crm_leads for insert to authenticated
  with check ((select public.is_project_admin()) and created_by = (select auth.uid()));
create policy "Project admins can update CRM leads"
  on public.crm_leads for update to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));
create policy "Project admins can delete CRM leads"
  on public.crm_leads for delete to authenticated
  using ((select public.is_project_admin()));

drop policy if exists "Project admins can manage CRM messages" on public.crm_messages;
drop policy if exists "Project admins can read CRM messages" on public.crm_messages;
drop policy if exists "Project admins can insert CRM messages" on public.crm_messages;
drop policy if exists "Project admins can update CRM messages" on public.crm_messages;
drop policy if exists "Project admins can delete CRM messages" on public.crm_messages;
create policy "Project admins can read CRM messages"
  on public.crm_messages for select to authenticated
  using ((select public.is_project_admin()))
;
create policy "Project admins can insert CRM messages"
  on public.crm_messages for insert to authenticated
  with check ((select public.is_project_admin()) and created_by = (select auth.uid()));
create policy "Project admins can update CRM messages"
  on public.crm_messages for update to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));
create policy "Project admins can delete CRM messages"
  on public.crm_messages for delete to authenticated
  using ((select public.is_project_admin()));

drop policy if exists "Project admins can manage CRM tasks" on public.crm_tasks;
drop policy if exists "Project admins can read CRM tasks" on public.crm_tasks;
drop policy if exists "Project admins can insert CRM tasks" on public.crm_tasks;
drop policy if exists "Project admins can update CRM tasks" on public.crm_tasks;
drop policy if exists "Project admins can delete CRM tasks" on public.crm_tasks;
create policy "Project admins can read CRM tasks"
  on public.crm_tasks for select to authenticated
  using ((select public.is_project_admin()))
;
create policy "Project admins can insert CRM tasks"
  on public.crm_tasks for insert to authenticated
  with check ((select public.is_project_admin()) and created_by = (select auth.uid()));
create policy "Project admins can update CRM tasks"
  on public.crm_tasks for update to authenticated
  using ((select public.is_project_admin()))
  with check ((select public.is_project_admin()));
create policy "Project admins can delete CRM tasks"
  on public.crm_tasks for delete to authenticated
  using ((select public.is_project_admin()));

grant select, insert, update, delete
  on public.crm_leads, public.crm_messages, public.crm_tasks
  to authenticated;
