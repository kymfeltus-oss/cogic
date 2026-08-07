-- Hotel reservation state and post-booking journey. A redirect never confirms a reservation.
create table public.travel_hotel_booking_journeys(
 id uuid primary key default gen_random_uuid(),program_key text not null default 'cogic-stream-2026',user_id uuid not null references auth.users(id) on delete cascade,
 hotel_id uuid references public.travel_hotels(id) on delete set null,room_type_id uuid references public.travel_hotel_room_types(id) on delete set null,
 selected_check_in date,selected_check_out date,redirect_destination text not null,reservation_status text not null default 'booking_started' check(reservation_status in('not_started','booking_started','awaiting_confirmation','confirmed','canceled')),
 booking_started_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.travel_hotel_reservations(
 id uuid primary key default gen_random_uuid(),program_key text not null default 'cogic-stream-2026',user_id uuid not null references auth.users(id) on delete cascade,
 journey_id uuid references public.travel_hotel_booking_journeys(id) on delete set null,hotel_id uuid references public.travel_hotels(id) on delete set null,room_type_id uuid references public.travel_hotel_room_types(id) on delete set null,
 hotel_name_snapshot text not null,room_type text not null,check_in date not null,check_out date not null,confirmation_number text,
 guest_count integer check(guest_count is null or guest_count>0),nightly_rate_cents integer check(nightly_rate_cents is null or nightly_rate_cents>=0),notes text,
 booking_source text not null check(booking_source in('attendee_manual','cogic_housing_import','admin','verified_provider')),
 reservation_status text not null default 'awaiting_confirmation' check(reservation_status in('not_started','booking_started','awaiting_confirmation','confirmed','canceled')),
 primary_stay boolean not null default false,verified_by uuid references auth.users(id) on delete set null,confirmed_at timestamptz,canceled_at timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),check(check_out>check_in),check(reservation_status<>'confirmed' or confirmation_number is not null)
);
create unique index travel_one_primary_active_stay on public.travel_hotel_reservations(program_key,user_id) where primary_stay and reservation_status='confirmed';
create index travel_reservations_owner_idx on public.travel_hotel_reservations(user_id,reservation_status,check_in);
create index travel_reservations_ops_idx on public.travel_hotel_reservations(program_key,reservation_status,hotel_id,check_in,check_out);
create table public.travel_hotel_reservation_audit(id bigint generated always as identity primary key,reservation_id uuid not null references public.travel_hotel_reservations(id) on delete cascade,actor_user_id uuid references auth.users(id) on delete set null,action text not null,details jsonb not null default '{}',created_at timestamptz not null default now());
alter table public.travel_hotel_booking_journeys enable row level security;alter table public.travel_hotel_reservations enable row level security;alter table public.travel_hotel_reservation_audit enable row level security;
create policy travel_booking_journey_owner_all on public.travel_hotel_booking_journeys for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy travel_reservation_owner_all on public.travel_hotel_reservations for all using(auth.uid()=user_id) with check(auth.uid()=user_id);
create policy travel_reservation_audit_owner_read on public.travel_hotel_reservation_audit for select using(exists(select 1 from public.travel_hotel_reservations r where r.id=reservation_id and r.user_id=auth.uid()));
revoke all on public.travel_hotel_booking_journeys,public.travel_hotel_reservations,public.travel_hotel_reservation_audit from anon;grant all on public.travel_hotel_booking_journeys,public.travel_hotel_reservations,public.travel_hotel_reservation_audit to service_role;
