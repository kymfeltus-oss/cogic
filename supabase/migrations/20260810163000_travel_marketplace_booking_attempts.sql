-- Marketplace booking attempts: partner handoff never confirms a reservation by itself.
create table if not exists public.travel_marketplace_booking_attempts (
  id uuid primary key default gen_random_uuid(),
  program_key text not null default 'cogic-stream-2026',
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('hotel', 'flight', 'car')),
  provider_key text not null,
  offer_id text not null,
  provider_offer_ref text,
  offer_snapshot jsonb not null default '{}'::jsonb,
  quoted_amount_cents integer check (quoted_amount_cents is null or quoted_amount_cents >= 0),
  currency text not null default 'USD',
  destination_label text,
  origin_label text,
  start_at timestamptz,
  end_at timestamptz,
  partner_booking_url text,
  return_path text not null default '/travel/trip',
  status text not null default 'booking_started'
    check (status in ('booking_started', 'pending_confirmation', 'confirmed', 'canceled', 'failed')),
  confirmation_number text,
  itinerary_kind text check (itinerary_kind is null or itinerary_kind in ('hotel', 'flight', 'car')),
  itinerary_record_id uuid,
  hotel_reservation_id uuid references public.travel_hotel_reservations(id) on delete set null,
  failure_reason text,
  started_at timestamptz not null default now(),
  redirected_at timestamptz,
  returned_at timestamptz,
  confirmed_at timestamptz,
  canceled_at timestamptz,
  updated_at timestamptz not null default now(),
  check (status <> 'confirmed' or confirmation_number is not null)
);

create index if not exists travel_marketplace_attempts_owner_idx
  on public.travel_marketplace_booking_attempts (user_id, status, started_at desc);
create index if not exists travel_marketplace_attempts_ops_idx
  on public.travel_marketplace_booking_attempts (program_key, status, kind, provider_key, started_at desc);

alter table public.travel_marketplace_booking_attempts enable row level security;

drop policy if exists travel_marketplace_attempts_owner_all on public.travel_marketplace_booking_attempts;
create policy travel_marketplace_attempts_owner_all
  on public.travel_marketplace_booking_attempts
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.travel_marketplace_booking_attempts from anon;
grant all on public.travel_marketplace_booking_attempts to service_role;

-- Allow marketplace hotel confirmations to use verified_provider booking_source.
alter table public.travel_hotel_reservations
  drop constraint if exists travel_hotel_reservations_booking_source_check;
alter table public.travel_hotel_reservations
  add constraint travel_hotel_reservations_booking_source_check
  check (booking_source in ('attendee_manual', 'cogic_housing_import', 'admin', 'verified_provider', 'marketplace'));
