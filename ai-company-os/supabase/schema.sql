-- AI Business Operating System — initial multi-company schema
-- Run in a new Supabase project SQL editor.

create extension if not exists pgcrypto;

create type public.member_role as enum ('owner','admin','manager','employee','viewer');
create type public.task_status as enum ('queued','running','waiting_approval','completed','failed','cancelled');
create type public.approval_status as enum ('pending','approved','rejected','expired');
create type public.finance_kind as enum ('income','expense');

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  kind text not null,
  currency text not null default 'EUR',
  timezone text not null default 'Europe/Berlin',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (company_id,user_id)
);

create table public.agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  name text not null,
  agent_key text not null,
  category text not null,
  instructions text not null default '',
  model_provider text,
  model_name text,
  max_cost_eur numeric(12,4) not null default 1,
  requires_approval boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique(company_id,agent_key)
);

create table public.agent_tasks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  agent_id uuid references public.agents(id) on delete set null,
  parent_task_id uuid references public.agent_tasks(id) on delete set null,
  title text not null,
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  status public.task_status not null default 'queued',
  priority smallint not null default 3 check (priority between 1 and 5),
  estimated_cost_eur numeric(12,4) not null default 0,
  actual_cost_eur numeric(12,4) not null default 0,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  task_id uuid references public.agent_tasks(id) on delete cascade,
  action_type text not null,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  status public.approval_status not null default 'pending',
  requested_by uuid references auth.users(id) on delete set null,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz
);

create table public.finance_entries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  kind public.finance_kind not null,
  amount numeric(14,2) not null check (amount >= 0),
  currency text not null default 'EUR',
  category text not null,
  description text,
  occurred_on date not null default current_date,
  source_type text,
  source_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  company_id uuid references public.companies(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_agent_id uuid references public.agents(id) on delete set null,
  event_type text not null,
  entity_type text,
  entity_id text,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index agent_tasks_company_status_idx on public.agent_tasks(company_id,status,created_at desc);
create index approvals_company_status_idx on public.approvals(company_id,status,created_at desc);
create index finance_entries_company_date_idx on public.finance_entries(company_id,occurred_on desc);
create index audit_events_company_created_idx on public.audit_events(company_id,created_at desc);

alter table public.companies enable row level security;
alter table public.company_members enable row level security;
alter table public.agents enable row level security;
alter table public.agent_tasks enable row level security;
alter table public.approvals enable row level security;
alter table public.finance_entries enable row level security;
alter table public.audit_events enable row level security;

create or replace function public.is_company_member(target_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id=target_company and m.user_id=auth.uid()
  );
$$;

create or replace function public.is_company_admin(target_company uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id=target_company and m.user_id=auth.uid()
      and m.role in ('owner','admin')
  );
$$;

create policy companies_member_read on public.companies
for select using (public.is_company_member(id));

create policy members_member_read on public.company_members
for select using (public.is_company_member(company_id));

create policy members_admin_write on public.company_members
for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

create policy agents_member_read on public.agents
for select using (company_id is null or public.is_company_member(company_id));
create policy agents_admin_write on public.agents
for all using (company_id is null or public.is_company_admin(company_id))
with check (company_id is null or public.is_company_admin(company_id));

create policy tasks_member_read on public.agent_tasks
for select using (public.is_company_member(company_id));
create policy tasks_member_insert on public.agent_tasks
for insert with check (public.is_company_member(company_id));
create policy tasks_admin_update on public.agent_tasks
for update using (public.is_company_admin(company_id));

create policy approvals_member_read on public.approvals
for select using (public.is_company_member(company_id));
create policy approvals_admin_write on public.approvals
for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

create policy finance_member_read on public.finance_entries
for select using (public.is_company_member(company_id));
create policy finance_admin_write on public.finance_entries
for all using (public.is_company_admin(company_id)) with check (public.is_company_admin(company_id));

create policy audit_member_read on public.audit_events
for select using (company_id is null or public.is_company_member(company_id));

insert into public.companies (name,slug,kind) values
('NWASB Werkstatt','nwasb-werkstatt','workshop'),
('Smart Parts 24','smart-parts-24','commerce'),
('Global AI Media System','global-ai-media','media'),
('Music & Video Factory','music-video-factory','production'),
('Agency & Client OS','agency-client-os','agency')
on conflict (slug) do nothing;
