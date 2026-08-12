-- Supplier change notifications for operator ops + /travel/trip ledger.
-- transaction_id is stored without a hard FK so this can apply even when the
-- transactional core ledger migration is still being repaired in an environment.

create table if not exists public.travel_supplier_change_events (
  id uuid primary key default gen_random_uuid(),
  program_key text not null default 'cogic-stream-2026',
  provider_key text not null,
  event_type text not null
    check (event_type in (
      'flight_time_change',
      'cancellation',
      'room_reassignment',
      'status_update',
      'other'
    )),
  provider_event_id text,
  marketplace_attempt_id uuid,
  transaction_id uuid,
  user_id uuid references auth.users(id) on delete cascade,
  summary text not null,
  payload jsonb not null default '{}'::jsonb,
  applied boolean not null default false,
  applied_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists travel_supplier_change_events_provider_event_uidx
  on public.travel_supplier_change_events (provider_key, provider_event_id)
  where provider_event_id is not null;

create index if not exists travel_supplier_change_events_user_idx
  on public.travel_supplier_change_events (user_id, created_at desc);

create index if not exists travel_supplier_change_events_attempt_idx
  on public.travel_supplier_change_events (marketplace_attempt_id, created_at desc);

alter table public.travel_supplier_change_events enable row level security;

drop policy if exists travel_supplier_change_events_owner_read on public.travel_supplier_change_events;
create policy travel_supplier_change_events_owner_read
  on public.travel_supplier_change_events
  for select
  using (auth.uid() = user_id);

revoke all on public.travel_supplier_change_events from anon;
grant select on public.travel_supplier_change_events to authenticated;
grant all on public.travel_supplier_change_events to service_role;

comment on table public.travel_supplier_change_events is
  'Live Expedia Rapid / Duffel change notifications applied to attendee trip ledgers.';
