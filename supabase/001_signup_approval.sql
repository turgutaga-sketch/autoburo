-- AutoBüro signup approval v1
-- Additive migration. Existing tenant/business data is not deleted or rewritten.

create table if not exists public.signup_requests (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  workshop_name text,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  note text
);

create index if not exists signup_requests_status_idx
  on public.signup_requests(status, requested_at desc);

alter table public.signup_requests enable row level security;

-- Applicant may only see their own request.
drop policy if exists "signup_request_self_read" on public.signup_requests;
create policy "signup_request_self_read"
  on public.signup_requests for select
  to authenticated
  using (user_id = auth.uid());

-- Applicant may create only their own pending request.
drop policy if exists "signup_request_self_insert" on public.signup_requests;
create policy "signup_request_self_insert"
  on public.signup_requests for insert
  to authenticated
  with check (user_id = auth.uid() and status = 'pending');

-- Auto-create a pending request after signup. No tenant data is created yet.
create or replace function public.autoburo_create_signup_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.signup_requests(user_id, email, workshop_name, status)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(trim(coalesce(new.raw_user_meta_data->>'workshop_name','')), ''),
    'pending'
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists autoburo_auth_user_created on auth.users;
create trigger autoburo_auth_user_created
after insert on auth.users
for each row execute function public.autoburo_create_signup_request();

-- Existing admins table is the source of truth for approval rights.
create or replace function public.autoburo_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists(select 1 from public.admins a where a.user_id = auth.uid());
$$;

-- Admin-only list for the approval screen.
create or replace function public.autoburo_list_signup_requests()
returns table(
  user_id uuid,
  email text,
  workshop_name text,
  status text,
  requested_at timestamptz,
  reviewed_at timestamptz,
  note text
)
language sql
security definer
set search_path = public
as $$
  select r.user_id, r.email, r.workshop_name, r.status,
         r.requested_at, r.reviewed_at, r.note
  from public.signup_requests r
  where public.autoburo_is_admin()
  order by r.requested_at desc;
$$;

-- Approval creates the tenant only once. Existing tenant rows are never overwritten.
create or replace function public.autoburo_review_signup(
  p_user_id uuid,
  p_approve boolean,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.signup_requests%rowtype;
  new_status text;
begin
  if not public.autoburo_is_admin() then
    raise exception 'not_authorized';
  end if;

  select * into r
  from public.signup_requests
  where user_id = p_user_id
  for update;

  if not found then raise exception 'request_not_found'; end if;

  new_status := case when p_approve then 'approved' else 'rejected' end;

  update public.signup_requests
  set status = new_status,
      reviewed_at = now(),
      reviewed_by = auth.uid(),
      note = p_note
  where user_id = p_user_id;

  if p_approve then
    insert into public.tenants(owner_id)
    values (p_user_id)
    on conflict (owner_id) do nothing;
  end if;

  return jsonb_build_object('ok', true, 'status', new_status);
end;
$$;

grant execute on function public.autoburo_is_admin() to authenticated;
grant execute on function public.autoburo_list_signup_requests() to authenticated;
grant execute on function public.autoburo_review_signup(uuid, boolean, text) to authenticated;

-- One read-only status function for the app gate.
create or replace function public.autoburo_my_access_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'approved', exists(select 1 from public.tenants t where t.owner_id = auth.uid()),
    'status', coalesce((select r.status from public.signup_requests r where r.user_id = auth.uid()), 'unknown')
  );
$$;

grant execute on function public.autoburo_my_access_status() to authenticated;
