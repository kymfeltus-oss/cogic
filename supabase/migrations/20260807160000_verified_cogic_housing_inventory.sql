-- Verified manual import from the official 118th Holy Convocation housing listing.
-- Source captured 2026-08-07. This is manually published COGIC availability, not live inventory.
alter table public.travel_hotels alter column address drop not null;
alter table public.travel_hotels alter column postal_code drop not null;
alter table public.travel_hotels add column if not exists slug text;
alter table public.travel_hotels add column if not exists cogic_designation text not null default 'GENERAL';
alter table public.travel_hotels add column if not exists minimum_nights integer check(minimum_nights is null or minimum_nights > 0);
alter table public.travel_hotels add column if not exists source_type text;
alter table public.travel_hotels add column if not exists source_event text;
alter table public.travel_hotels add column if not exists source_year integer;
alter table public.travel_hotels add column if not exists source_verified_at timestamptz;
create unique index if not exists travel_hotels_program_slug_key on public.travel_hotels(program_key,slug) where slug is not null;

create table if not exists public.travel_hotel_room_types(
 id uuid primary key default gen_random_uuid(), program_key text not null default 'cogic-stream-2026',
 hotel_id uuid not null references public.travel_hotels(id) on delete cascade,
 name text not null, nightly_rate_cents integer not null check(nightly_rate_cents >= 0), currency text not null default 'USD',
 published boolean not null default false, display_order integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(hotel_id,name)
);
create table if not exists public.travel_hotel_nightly_availability(
 id bigint generated always as identity primary key, program_key text not null default 'cogic-stream-2026',
 room_type_id uuid not null references public.travel_hotel_room_types(id) on delete cascade,
 stay_date date not null, availability_status text not null check(availability_status in('AVAILABLE','UNAVAILABLE')),
 nightly_rate_cents integer not null check(nightly_rate_cents >= 0), source_verified_at timestamptz not null,
 updated_by uuid references auth.users(id) on delete set null, updated_at timestamptz not null default now(), unique(room_type_id,stay_date)
);
alter table public.travel_hotel_room_types enable row level security;
alter table public.travel_hotel_nightly_availability enable row level security;
drop policy if exists travel_room_types_public_read on public.travel_hotel_room_types;
create policy travel_room_types_public_read on public.travel_hotel_room_types for select using(published);
drop policy if exists travel_nightly_public_read on public.travel_hotel_nightly_availability;
create policy travel_nightly_public_read on public.travel_hotel_nightly_availability for select using(exists(select 1 from public.travel_hotel_room_types r join public.travel_hotels h on h.id=r.hotel_id where r.id=room_type_id and r.published and h.published and not h.archived));
create index if not exists travel_nightly_room_date_idx on public.travel_hotel_nightly_availability(room_type_id,stay_date);

update public.travel_hotels set published=false,archived=true,updated_at=now() where program_key='cogic-stream-2026';
delete from public.travel_hotels where program_key='cogic-stream-2026' and archived=true;

insert into public.travel_hotels(id,program_key,slug,name,description,address,city,state,postal_code,official_cogic,negotiated_rate_cents,rate_currency,availability_message,amenities,published,archived,display_order,cogic_designation,minimum_nights,source_type,source_event,source_year,source_verified_at,updated_at)
values
('a0000000-0000-4000-8000-000000000001','cogic-stream-2026','hotel-saint-louis','Hotel Saint Louis, Autograph Collection','Historic downtown St. Louis property located in an 1893 landmark. The official COGIC housing description emphasizes the property''s connection to St. Louis history and describes it as a bespoke environment inspired by the city''s legacy and modern changemakers.',null,'St. Louis','Missouri',null,true,21900,'USD','Availability varies by date.',array[]::text[],true,false,1,'GENERAL',6,'official_cogic_housing','118th Holy Convocation',2026,'2026-08-07T12:00:00-05:00',now()),
('a0000000-0000-4000-8000-000000000002','cogic-stream-2026','hampton-inn-gateway-arch','Hampton Inn Gateway Arch','Located in downtown St. Louis near the Gateway Arch. The official housing information highlights Gateway Arch views, contemporary guestrooms, and convenient access to St. Louis attractions.',null,'St. Louis','Missouri',null,true,18800,'USD','Availability varies by date.',array['Gateway Arch views','Nonsmoking property','Contemporary guestrooms','Flat-screen televisions','Free high-speed internet','Complimentary hot breakfast'],true,false,2,'GENERAL',null,'official_cogic_housing','118th Holy Convocation',2026,'2026-08-07T12:00:00-05:00',now()),
('a0000000-0000-4000-8000-000000000003','cogic-stream-2026','bishops-hyatt-regency','Hyatt Regency Saint Louis at The Arch','Steps from the Gateway Arch in downtown St. Louis, with multiple on-site dining options including RED Kitchen, Ruth''s Chris Steak House, Brewhouse Historical Sports Bar, and RED Bar.',null,'St. Louis','Missouri',null,true,21200,'USD','Availability varies significantly by date.',array['50-inch flat-screen televisions','Free Wi-Fi','Small refrigerator in rooms','Ironing facilities','24-hour fitness center','Business center','Multiple on-site dining options'],true,false,3,'BISHOPS',null,'official_cogic_housing','118th Holy Convocation',2026,'2026-08-07T12:00:00-05:00',now()),
('a0000000-0000-4000-8000-000000000004','cogic-stream-2026','21c-museum-hotel','21c Museum Hotel St. Louis','A 173-room downtown boutique hotel featuring a contemporary art museum, Idol Wolf restaurant, Good Press café, Locust Street Athletic and Swim Club, and a full-service wellness experience.',null,'St. Louis','Missouri',null,true,22900,'USD','Availability varies by date.',array['Contemporary art museum','Idol Wolf restaurant','Good Press café','Locust Street Athletic and Swim Club','Full-service wellness experience'],true,false,4,'GENERAL',null,'official_cogic_housing','118th Holy Convocation',2026,'2026-08-07T12:00:00-05:00',now())
on conflict(id) do update set slug=excluded.slug,name=excluded.name,description=excluded.description,address=null,city=excluded.city,state=excluded.state,postal_code=null,negotiated_rate_cents=excluded.negotiated_rate_cents,availability_message=excluded.availability_message,amenities=excluded.amenities,published=true,archived=false,display_order=excluded.display_order,cogic_designation=excluded.cogic_designation,minimum_nights=excluded.minimum_nights,source_type=excluded.source_type,source_event=excluded.source_event,source_year=excluded.source_year,source_verified_at=excluded.source_verified_at,updated_at=now();

insert into public.travel_hotel_room_types(id,program_key,hotel_id,name,nightly_rate_cents,published,display_order) values
('b0000000-0000-4000-8000-000000000001','cogic-stream-2026','a0000000-0000-4000-8000-000000000001','KING',21900,true,1),
('b0000000-0000-4000-8000-000000000002','cogic-stream-2026','a0000000-0000-4000-8000-000000000001','QUEEN / QUEEN',21900,true,2),
('b0000000-0000-4000-8000-000000000003','cogic-stream-2026','a0000000-0000-4000-8000-000000000001','CORNER KING',22900,true,3),
('b0000000-0000-4000-8000-000000000004','cogic-stream-2026','a0000000-0000-4000-8000-000000000001','KING SUITE',27900,true,4),
('b0000000-0000-4000-8000-000000000005','cogic-stream-2026','a0000000-0000-4000-8000-000000000002','KING',18800,true,1),
('b0000000-0000-4000-8000-000000000006','cogic-stream-2026','a0000000-0000-4000-8000-000000000002','DOUBLE',18800,true,2),
('b0000000-0000-4000-8000-000000000007','cogic-stream-2026','a0000000-0000-4000-8000-000000000003','DELUXE DOUBLE',21200,true,1),
('b0000000-0000-4000-8000-000000000008','cogic-stream-2026','a0000000-0000-4000-8000-000000000003','EXECUTIVE SUITE',23700,true,2),
('b0000000-0000-4000-8000-000000000009','cogic-stream-2026','a0000000-0000-4000-8000-000000000004','LUXURY KING SUITE',22900,true,1),
('b0000000-0000-4000-8000-000000000010','cogic-stream-2026','a0000000-0000-4000-8000-000000000004','LIBRARY KING SUITE',24900,true,2)
on conflict(id) do update set name=excluded.name,nightly_rate_cents=excluded.nightly_rate_cents,published=true,display_order=excluded.display_order,updated_at=now();

insert into public.travel_hotel_nightly_availability(program_key,room_type_id,stay_date,availability_status,nightly_rate_cents,source_verified_at)
select 'cogic-stream-2026',r.id,d::date,'UNAVAILABLE',r.nightly_rate_cents,'2026-08-07T12:00:00-05:00'::timestamptz from public.travel_hotel_room_types r cross join generate_series('2026-10-27'::date,'2026-11-14'::date,'1 day') d where r.program_key='cogic-stream-2026'
on conflict(room_type_id,stay_date) do update set availability_status='UNAVAILABLE',nightly_rate_cents=excluded.nightly_rate_cents,source_verified_at=excluded.source_verified_at,updated_at=now();

with available(room_id,dates) as (values
('b0000000-0000-4000-8000-000000000001'::uuid,array['2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-07','2026-11-08','2026-11-09','2026-11-10','2026-11-11']::date[]),
('b0000000-0000-4000-8000-000000000002'::uuid,array['2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-08','2026-11-09','2026-11-10','2026-11-11']::date[]),
('b0000000-0000-4000-8000-000000000003'::uuid,array['2026-11-01','2026-11-02','2026-11-03','2026-11-09','2026-11-10','2026-11-11']::date[]),
('b0000000-0000-4000-8000-000000000004'::uuid,array['2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-10','2026-11-11']::date[]),
('b0000000-0000-4000-8000-000000000005'::uuid,array['2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-08','2026-11-09']::date[]),
('b0000000-0000-4000-8000-000000000006'::uuid,array['2026-10-31','2026-11-01','2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09']::date[]),
('b0000000-0000-4000-8000-000000000007'::uuid,array['2026-11-02','2026-11-03','2026-11-04','2026-11-05','2026-11-06','2026-11-07','2026-11-08','2026-11-09','2026-11-10']::date[]),
('b0000000-0000-4000-8000-000000000008'::uuid,array['2026-11-02','2026-11-10','2026-11-11']::date[]),
('b0000000-0000-4000-8000-000000000009'::uuid,array['2026-11-01','2026-11-02','2026-11-03','2026-11-08','2026-11-09','2026-11-10']::date[]),
('b0000000-0000-4000-8000-000000000010'::uuid,array['2026-11-01','2026-11-02','2026-11-10']::date[]))
update public.travel_hotel_nightly_availability n set availability_status='AVAILABLE',updated_at=now() from available a where n.room_type_id=a.room_id and n.stay_date=any(a.dates);
