-- WERK ONE · Product Analytics v1
-- Additive migration. Does not modify or delete existing workshop data.

create extension if not exists pgcrypto;

create table if not exists public.product_events (
  id uuid primary key default gen_random_uuid(),
  event_name text not null check (char_length(event_name) between 1 and 80),
  module_name text not null default 'unknown' check (char_length(module_name) between 1 and 50),
  session_id uuid not null,
  device_type text not null default 'unknown' check (device_type in ('mobile','tablet','desktop','unknown')),
  success boolean,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint product_events_metadata_size check (octet_length(metadata::text) <= 4096)
);

create index if not exists product_events_occurred_at_idx
  on public.product_events (occurred_at desc);

create index if not exists product_events_module_name_idx
  on public.product_events (module_name, occurred_at desc);

create index if not exists product_events_event_name_idx
  on public.product_events (event_name, occurred_at desc);

alter table public.product_events enable row level security;

-- Public clients may only append strictly technical events.
drop policy if exists "product_events_insert_anon" on public.product_events;
create policy "product_events_insert_anon"
on public.product_events
for insert
to anon, authenticated
with check (
  event_name !~* '(name|email|phone|iban|bank|plate|vin|fahrgestell|customer|kunde|invoice|rechnung|document|message|note|text|address)'
  and module_name !~* '(name|email|phone|iban|bank|plate|vin|fahrgestell|customer|kunde|invoice|rechnung|document|message|note|text|address)'
  and jsonb_typeof(metadata) = 'object'
);

-- Only the product owner may read analytics.
drop policy if exists "product_events_owner_read" on public.product_events;
create policy "product_events_owner_read"
on public.product_events
for select
to authenticated
using (lower(coalesce(auth.jwt() ->> 'email', '')) = 'turgutaga@me.com');

-- No update or delete policies are created intentionally.
-- Events are append-only from the application.

create or replace view public.product_analytics_daily
with (security_invoker = true)
as
select
  date_trunc('day', occurred_at) as day,
  module_name,
  event_name,
  device_type,
  count(*) as event_count,
  count(distinct session_id) as unique_sessions,
  count(*) filter (where success is false) as failed_events,
  round(avg(duration_ms))::bigint as avg_duration_ms
from public.product_events
group by 1, 2, 3, 4;

grant insert on public.product_events to anon, authenticated;
grant select on public.product_events to authenticated;
grant select on public.product_analytics_daily to authenticated;

comment on table public.product_events is
'WERK ONE anonymous technical usage events. Must never contain customer, vehicle, invoice, bank, document or free-text business data.';
