-- COGIC Travel transactional core.
-- Replaces partner-redirect / manual-confirmation authority with a unified
-- booking state machine across marketplace attempts and official hotel journeys.
-- Confirmed stays require supplier_confirmation_number. Redirect alone never confirms.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'travel_transaction_status'
  ) then
    create type public.travel_transaction_status as enum (
      'DRAFT',
      'PAYMENT_PENDING',
      'SUPPLIER_SUBMITTED',
      'CONFIRMED',
      'FAILED',
      'REFUNDED'
    );
  end if;
end $$;

create or replace function public.travel_transaction_status_rank(
  status public.travel_transaction_status
) returns integer
language sql
immutable
as $$
  select case status
    when 'DRAFT' then 10
    when 'PAYMENT_PENDING' then 20
    when 'SUPPLIER_SUBMITTED' then 30
    when 'CONFIRMED' then 40
    when 'FAILED' then 50
    when 'REFUNDED' then 60
    else 0
  end;
$$;

create or replace function public.travel_assert_transaction_transition(
  from_status public.travel_transaction_status,
  to_status public.travel_transaction_status
) returns void
language plpgsql
immutable
as $$
begin
  if from_status is not distinct from to_status then
    return;
  end if;

  if from_status = 'DRAFT' and to_status in ('PAYMENT_PENDING', 'SUPPLIER_SUBMITTED', 'FAILED') then
    return;
  end if;
  if from_status = 'PAYMENT_PENDING' and to_status in ('SUPPLIER_SUBMITTED', 'CONFIRMED', 'FAILED', 'REFUNDED') then
    return;
  end if;
  if from_status = 'SUPPLIER_SUBMITTED' and to_status in ('CONFIRMED', 'FAILED', 'REFUNDED') then
    return;
  end if;
  if from_status = 'CONFIRMED' and to_status in ('REFUNDED', 'FAILED') then
    return;
  end if;
  if from_status = 'FAILED' and to_status = 'DRAFT' then
    return;
  end if;

  raise exception 'Invalid travel transaction transition: % → %', from_status, to_status
    using errcode = '22023';
end;
$$;

create or replace function public.map_legacy_marketplace_attempt_status(
  legacy text
) returns public.travel_transaction_status
language sql
immutable
as $$
  select case lower(coalesce(legacy, ''))
    when 'booking_started' then 'DRAFT'::public.travel_transaction_status
    when 'pending_confirmation' then 'SUPPLIER_SUBMITTED'::public.travel_transaction_status
    when 'confirmed' then 'CONFIRMED'::public.travel_transaction_status
    when 'canceled' then 'FAILED'::public.travel_transaction_status
    when 'failed' then 'FAILED'::public.travel_transaction_status
    when 'draft' then 'DRAFT'::public.travel_transaction_status
    when 'payment_pending' then 'PAYMENT_PENDING'::public.travel_transaction_status
    when 'supplier_submitted' then 'SUPPLIER_SUBMITTED'::public.travel_transaction_status
    when 'refunded' then 'REFUNDED'::public.travel_transaction_status
    else 'DRAFT'::public.travel_transaction_status
  end;
$$;

create or replace function public.map_legacy_hotel_journey_status(
  legacy text
) returns public.travel_transaction_status
language sql
immutable
as $$
  select case lower(coalesce(legacy, ''))
    when 'not_started' then 'DRAFT'::public.travel_transaction_status
    when 'booking_started' then 'DRAFT'::public.travel_transaction_status
    when 'awaiting_confirmation' then 'PAYMENT_PENDING'::public.travel_transaction_status
    when 'confirmed' then 'CONFIRMED'::public.travel_transaction_status
    when 'canceled' then 'FAILED'::public.travel_transaction_status
    when 'draft' then 'DRAFT'::public.travel_transaction_status
    when 'payment_pending' then 'PAYMENT_PENDING'::public.travel_transaction_status
    when 'supplier_submitted' then 'SUPPLIER_SUBMITTED'::public.travel_transaction_status
    when 'failed' then 'FAILED'::public.travel_transaction_status
    when 'refunded' then 'REFUNDED'::public.travel_transaction_status
    else 'DRAFT'::public.travel_transaction_status
  end;
$$;

-- ---------------------------------------------------------------------------
-- Marketplace booking attempts → transactional columns + unified status
-- ---------------------------------------------------------------------------
alter table public.travel_marketplace_booking_attempts
  add column if not exists payment_intent_id varchar(255),
  add column if not exists supplier_confirmation_number varchar(255),
  add column if not exists supplier_raw_response jsonb not null default '{}'::jsonb,
  add column if not exists total_amount_cents integer,
  add column if not exists tax_amount_cents integer,
  add column if not exists transaction_status public.travel_transaction_status;

update public.travel_marketplace_booking_attempts
set
  transaction_status = public.map_legacy_marketplace_attempt_status(status),
  supplier_confirmation_number = coalesce(
    nullif(btrim(supplier_confirmation_number), ''),
    nullif(btrim(confirmation_number), '')
  ),
  total_amount_cents = coalesce(total_amount_cents, quoted_amount_cents),
  tax_amount_cents = coalesce(tax_amount_cents, 0),
  supplier_raw_response = coalesce(supplier_raw_response, '{}'::jsonb)
where transaction_status is null
   or supplier_confirmation_number is null
   or total_amount_cents is null
   or tax_amount_cents is null;

update public.travel_marketplace_booking_attempts
set transaction_status = 'DRAFT'::public.travel_transaction_status
where transaction_status is null;

alter table public.travel_marketplace_booking_attempts
  alter column transaction_status set default 'DRAFT'::public.travel_transaction_status,
  alter column transaction_status set not null,
  alter column tax_amount_cents set default 0;

alter table public.travel_marketplace_booking_attempts
  drop constraint if exists travel_marketplace_booking_attempts_status_check;

alter table public.travel_marketplace_booking_attempts
  drop constraint if exists travel_marketplace_booking_attempts_check;

alter table public.travel_marketplace_booking_attempts
  drop column if exists status;

alter table public.travel_marketplace_booking_attempts
  rename column transaction_status to status;

alter table public.travel_marketplace_booking_attempts
  drop constraint if exists travel_marketplace_attempts_amounts_check;
alter table public.travel_marketplace_booking_attempts
  add constraint travel_marketplace_attempts_amounts_check
  check (
    (total_amount_cents is null or total_amount_cents >= 0)
    and (tax_amount_cents is null or tax_amount_cents >= 0)
    and (quoted_amount_cents is null or quoted_amount_cents >= 0)
  );

alter table public.travel_marketplace_booking_attempts
  drop constraint if exists travel_marketplace_attempts_confirmed_requires_supplier;
alter table public.travel_marketplace_booking_attempts
  add constraint travel_marketplace_attempts_confirmed_requires_supplier
  check (
    status <> 'CONFIRMED'
    or (
      supplier_confirmation_number is not null
      and length(btrim(supplier_confirmation_number)) >= 3
    )
  );

alter table public.travel_marketplace_booking_attempts
  drop constraint if exists travel_marketplace_attempts_user_required;
alter table public.travel_marketplace_booking_attempts
  add constraint travel_marketplace_attempts_user_required
  check (user_id is not null);

create index if not exists travel_marketplace_attempts_payment_intent_idx
  on public.travel_marketplace_booking_attempts (payment_intent_id)
  where payment_intent_id is not null;

create index if not exists travel_marketplace_attempts_supplier_conf_idx
  on public.travel_marketplace_booking_attempts (supplier_confirmation_number)
  where supplier_confirmation_number is not null;

create index if not exists travel_marketplace_attempts_status_idx
  on public.travel_marketplace_booking_attempts (program_key, status, kind, started_at desc);

-- ---------------------------------------------------------------------------
-- Official hotel booking journeys → transactional columns + unified status
-- ---------------------------------------------------------------------------
alter table public.travel_hotel_booking_journeys
  add column if not exists payment_intent_id varchar(255),
  add column if not exists supplier_confirmation_number varchar(255),
  add column if not exists supplier_raw_response jsonb not null default '{}'::jsonb,
  add column if not exists total_amount_cents integer,
  add column if not exists tax_amount_cents integer,
  add column if not exists transaction_status public.travel_transaction_status,
  add column if not exists hotel_reservation_id uuid references public.travel_hotel_reservations(id) on delete set null,
  add column if not exists failure_reason text,
  add column if not exists currency text not null default 'USD';

update public.travel_hotel_booking_journeys
set
  transaction_status = public.map_legacy_hotel_journey_status(reservation_status),
  tax_amount_cents = coalesce(tax_amount_cents, 0),
  supplier_raw_response = coalesce(supplier_raw_response, '{}'::jsonb)
where transaction_status is null
   or tax_amount_cents is null;

update public.travel_hotel_booking_journeys
set transaction_status = 'DRAFT'::public.travel_transaction_status
where transaction_status is null;

alter table public.travel_hotel_booking_journeys
  alter column transaction_status set default 'DRAFT'::public.travel_transaction_status,
  alter column transaction_status set not null,
  alter column tax_amount_cents set default 0;

alter table public.travel_hotel_booking_journeys
  drop constraint if exists travel_hotel_booking_journeys_reservation_status_check;

alter table public.travel_hotel_booking_journeys
  drop column if exists reservation_status;

alter table public.travel_hotel_booking_journeys
  rename column transaction_status to status;

alter table public.travel_hotel_booking_journeys
  drop constraint if exists travel_hotel_journeys_amounts_check;
alter table public.travel_hotel_booking_journeys
  add constraint travel_hotel_journeys_amounts_check
  check (
    (total_amount_cents is null or total_amount_cents >= 0)
    and (tax_amount_cents is null or tax_amount_cents >= 0)
  );

-- Legacy rows may have been marked confirmed without a supplier confirmation.
-- Demote them before enforcing the transactional invariant.
update public.travel_hotel_booking_journeys
set
  status = 'FAILED'::public.travel_transaction_status,
  failure_reason = coalesce(
    nullif(btrim(failure_reason), ''),
    'Legacy journey lacked supplier confirmation number'
  ),
  updated_at = now()
where status = 'CONFIRMED'::public.travel_transaction_status
  and (
    supplier_confirmation_number is null
    or length(btrim(supplier_confirmation_number)) < 3
  );

alter table public.travel_hotel_booking_journeys
  drop constraint if exists travel_hotel_journeys_confirmed_requires_supplier;
alter table public.travel_hotel_booking_journeys
  add constraint travel_hotel_journeys_confirmed_requires_supplier
  check (
    status <> 'CONFIRMED'
    or (
      supplier_confirmation_number is not null
      and length(btrim(supplier_confirmation_number)) >= 3
    )
  );

alter table public.travel_hotel_booking_journeys
  drop constraint if exists travel_hotel_journeys_user_required;
alter table public.travel_hotel_booking_journeys
  add constraint travel_hotel_journeys_user_required
  check (user_id is not null);

create index if not exists travel_hotel_journeys_payment_intent_idx
  on public.travel_hotel_booking_journeys (payment_intent_id)
  where payment_intent_id is not null;

create index if not exists travel_hotel_journeys_supplier_conf_idx
  on public.travel_hotel_booking_journeys (supplier_confirmation_number)
  where supplier_confirmation_number is not null;

create index if not exists travel_hotel_journeys_status_idx
  on public.travel_hotel_booking_journeys (program_key, status, booking_started_at desc);

-- ---------------------------------------------------------------------------
-- Unified transaction ledger (search → payment → supplier → reservation)
-- ---------------------------------------------------------------------------
create table if not exists public.travel_booking_transactions (
  id uuid primary key default gen_random_uuid(),
  program_key text not null default 'cogic-stream-2026',
  user_id uuid not null references auth.users(id) on delete cascade,
  lane text not null check (lane in ('official_hotel', 'marketplace')),
  kind text not null check (kind in ('hotel', 'flight', 'car')),
  status public.travel_transaction_status not null default 'DRAFT',
  marketplace_attempt_id uuid references public.travel_marketplace_booking_attempts(id) on delete set null,
  hotel_journey_id uuid references public.travel_hotel_booking_journeys(id) on delete set null,
  hotel_reservation_id uuid references public.travel_hotel_reservations(id) on delete set null,
  itinerary_kind text check (itinerary_kind is null or itinerary_kind in ('hotel', 'flight', 'car')),
  itinerary_record_id uuid,
  provider_key text,
  offer_id text,
  payment_intent_id varchar(255),
  supplier_confirmation_number varchar(255),
  supplier_raw_response jsonb not null default '{}'::jsonb,
  total_amount_cents integer,
  tax_amount_cents integer not null default 0,
  currency text not null default 'USD',
  destination_label text,
  origin_label text,
  start_at timestamptz,
  end_at timestamptz,
  failure_reason text,
  offer_snapshot jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default now(),
  payment_pending_at timestamptz,
  supplier_submitted_at timestamptz,
  confirmed_at timestamptz,
  failed_at timestamptz,
  refunded_at timestamptz,
  updated_at timestamptz not null default now(),
  check (total_amount_cents is null or total_amount_cents >= 0),
  check (tax_amount_cents >= 0),
  check (
    status <> 'CONFIRMED'
    or (
      supplier_confirmation_number is not null
      and length(btrim(supplier_confirmation_number)) >= 3
    )
  ),
  check (
    (lane = 'marketplace' and marketplace_attempt_id is not null)
    or (lane = 'official_hotel' and hotel_journey_id is not null)
  )
);

create unique index if not exists travel_booking_txn_marketplace_attempt_uidx
  on public.travel_booking_transactions (marketplace_attempt_id)
  where marketplace_attempt_id is not null;

create unique index if not exists travel_booking_txn_hotel_journey_uidx
  on public.travel_booking_transactions (hotel_journey_id)
  where hotel_journey_id is not null;

create index if not exists travel_booking_txn_owner_idx
  on public.travel_booking_transactions (user_id, status, started_at desc);

create index if not exists travel_booking_txn_ops_idx
  on public.travel_booking_transactions (program_key, lane, kind, status, started_at desc);

create index if not exists travel_booking_txn_payment_intent_idx
  on public.travel_booking_transactions (payment_intent_id)
  where payment_intent_id is not null;

create index if not exists travel_booking_txn_supplier_conf_idx
  on public.travel_booking_transactions (supplier_confirmation_number)
  where supplier_confirmation_number is not null;

create table if not exists public.travel_booking_transaction_events (
  id bigint generated always as identity primary key,
  transaction_id uuid not null references public.travel_booking_transactions(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  from_status public.travel_transaction_status,
  to_status public.travel_transaction_status not null,
  event_name text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists travel_booking_txn_events_txn_idx
  on public.travel_booking_transaction_events (transaction_id, created_at desc);

create or replace function public.travel_booking_transactions_enforce_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.travel_assert_transaction_transition(old.status, new.status);
    new.updated_at := now();
    if new.status = 'PAYMENT_PENDING' then
      new.payment_pending_at := coalesce(new.payment_pending_at, now());
    elsif new.status = 'SUPPLIER_SUBMITTED' then
      new.supplier_submitted_at := coalesce(new.supplier_submitted_at, now());
    elsif new.status = 'CONFIRMED' then
      new.confirmed_at := coalesce(new.confirmed_at, now());
    elsif new.status = 'FAILED' then
      new.failed_at := coalesce(new.failed_at, now());
    elsif new.status = 'REFUNDED' then
      new.refunded_at := coalesce(new.refunded_at, now());
    end if;
  end if;

  if new.user_id is null then
    raise exception 'travel_booking_transactions.user_id is required'
      using errcode = '23502';
  end if;

  return new;
end;
$$;

drop trigger if exists travel_booking_transactions_transition_trg
  on public.travel_booking_transactions;
create trigger travel_booking_transactions_transition_trg
  before update on public.travel_booking_transactions
  for each row
  execute function public.travel_booking_transactions_enforce_transition();

create or replace function public.travel_lane_status_enforce_transition()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and new.status is distinct from old.status then
    perform public.travel_assert_transaction_transition(old.status, new.status);
    new.updated_at := now();
  end if;
  if new.user_id is null then
    raise exception '% user_id is required', tg_table_name
      using errcode = '23502';
  end if;
  return new;
end;
$$;

drop trigger if exists travel_marketplace_attempts_transition_trg
  on public.travel_marketplace_booking_attempts;
create trigger travel_marketplace_attempts_transition_trg
  before update on public.travel_marketplace_booking_attempts
  for each row
  execute function public.travel_lane_status_enforce_transition();

drop trigger if exists travel_hotel_journeys_transition_trg
  on public.travel_hotel_booking_journeys;
create trigger travel_hotel_journeys_transition_trg
  before update on public.travel_hotel_booking_journeys
  for each row
  execute function public.travel_lane_status_enforce_transition();

-- Backfill ledger rows from existing lane records (idempotent via unique indexes).
insert into public.travel_booking_transactions (
  program_key,
  user_id,
  lane,
  kind,
  status,
  marketplace_attempt_id,
  hotel_reservation_id,
  itinerary_kind,
  itinerary_record_id,
  provider_key,
  offer_id,
  payment_intent_id,
  supplier_confirmation_number,
  supplier_raw_response,
  total_amount_cents,
  tax_amount_cents,
  currency,
  destination_label,
  origin_label,
  start_at,
  end_at,
  failure_reason,
  offer_snapshot,
  started_at,
  supplier_submitted_at,
  confirmed_at,
  failed_at,
  updated_at
)
select
  a.program_key,
  a.user_id,
  'marketplace',
  a.kind,
  a.status,
  a.id,
  a.hotel_reservation_id,
  a.itinerary_kind,
  a.itinerary_record_id,
  a.provider_key,
  a.offer_id,
  a.payment_intent_id,
  a.supplier_confirmation_number,
  coalesce(a.supplier_raw_response, '{}'::jsonb),
  coalesce(a.total_amount_cents, a.quoted_amount_cents),
  coalesce(a.tax_amount_cents, 0),
  coalesce(a.currency, 'USD'),
  a.destination_label,
  a.origin_label,
  a.start_at,
  a.end_at,
  a.failure_reason,
  coalesce(a.offer_snapshot, '{}'::jsonb),
  a.started_at,
  a.returned_at,
  a.confirmed_at,
  case when a.status = 'FAILED' then coalesce(a.canceled_at, a.updated_at) else null end,
  a.updated_at
from public.travel_marketplace_booking_attempts a
where not exists (
  select 1
  from public.travel_booking_transactions t
  where t.marketplace_attempt_id = a.id
);

insert into public.travel_booking_transactions (
  program_key,
  user_id,
  lane,
  kind,
  status,
  hotel_journey_id,
  hotel_reservation_id,
  provider_key,
  payment_intent_id,
  supplier_confirmation_number,
  supplier_raw_response,
  total_amount_cents,
  tax_amount_cents,
  currency,
  start_at,
  end_at,
  failure_reason,
  offer_snapshot,
  started_at,
  confirmed_at,
  failed_at,
  updated_at
)
select
  j.program_key,
  j.user_id,
  'official_hotel',
  'hotel',
  j.status,
  j.id,
  j.hotel_reservation_id,
  'cogic_official',
  j.payment_intent_id,
  j.supplier_confirmation_number,
  coalesce(j.supplier_raw_response, '{}'::jsonb),
  j.total_amount_cents,
  coalesce(j.tax_amount_cents, 0),
  coalesce(j.currency, 'USD'),
  case
    when j.selected_check_in is not null then (j.selected_check_in::timestamp at time zone 'UTC')
    else null
  end,
  case
    when j.selected_check_out is not null then (j.selected_check_out::timestamp at time zone 'UTC')
    else null
  end,
  j.failure_reason,
  jsonb_build_object(
    'hotel_id', j.hotel_id,
    'room_type_id', j.room_type_id,
    'redirect_destination', j.redirect_destination
  ),
  j.booking_started_at,
  case when j.status = 'CONFIRMED' then j.updated_at else null end,
  case when j.status = 'FAILED' then j.updated_at else null end,
  j.updated_at
from public.travel_hotel_booking_journeys j
where not exists (
  select 1
  from public.travel_booking_transactions t
  where t.hotel_journey_id = j.id
);

-- ---------------------------------------------------------------------------
-- RLS: authenticated owners only; anon denied; service_role full access
-- ---------------------------------------------------------------------------
alter table public.travel_booking_transactions enable row level security;
alter table public.travel_booking_transaction_events enable row level security;

drop policy if exists travel_booking_transactions_owner_all
  on public.travel_booking_transactions;
create policy travel_booking_transactions_owner_all
  on public.travel_booking_transactions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and user_id is not null);

drop policy if exists travel_booking_txn_events_owner_read
  on public.travel_booking_transaction_events;
create policy travel_booking_txn_events_owner_read
  on public.travel_booking_transaction_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.travel_booking_transactions t
      where t.id = transaction_id
        and t.user_id = auth.uid()
    )
  );

drop policy if exists travel_marketplace_attempts_owner_all
  on public.travel_marketplace_booking_attempts;
create policy travel_marketplace_attempts_owner_all
  on public.travel_marketplace_booking_attempts
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and user_id is not null);

drop policy if exists travel_booking_journey_owner_all
  on public.travel_hotel_booking_journeys;
create policy travel_booking_journey_owner_all
  on public.travel_hotel_booking_journeys
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and user_id is not null);

revoke all on public.travel_booking_transactions from anon, authenticated;
revoke all on public.travel_booking_transaction_events from anon, authenticated;
revoke all on public.travel_marketplace_booking_attempts from anon;
revoke all on public.travel_hotel_booking_journeys from anon;

grant select, insert, update, delete on public.travel_booking_transactions to authenticated;
grant select on public.travel_booking_transaction_events to authenticated;
grant all on public.travel_booking_transactions to service_role;
grant all on public.travel_booking_transaction_events to service_role;
grant all on public.travel_marketplace_booking_attempts to service_role;
grant all on public.travel_hotel_booking_journeys to service_role;

grant usage on type public.travel_transaction_status to authenticated, service_role;

comment on type public.travel_transaction_status is
  'Unified COGIC Travel booking state machine for marketplace attempts, official hotel journeys, and the transaction ledger.';
comment on table public.travel_booking_transactions is
  'Authoritative travel booking transaction ledger. CONFIRMED requires supplier_confirmation_number; payment_intent_id binds Stripe payment authority.';
comment on column public.travel_marketplace_booking_attempts.status is
  'Unified travel_transaction_status values: DRAFT, PAYMENT_PENDING, SUPPLIER_SUBMITTED, CONFIRMED, FAILED, REFUNDED.';
comment on column public.travel_hotel_booking_journeys.status is
  'Unified travel_transaction_status values: DRAFT, PAYMENT_PENDING, SUPPLIER_SUBMITTED, CONFIRMED, FAILED, REFUNDED.';
