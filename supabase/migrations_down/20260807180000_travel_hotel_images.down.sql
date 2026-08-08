drop table if exists public.travel_hotel_nightly_availability;
update public.travel_hotels set image_url=null where program_key='cogic-stream-2026' and slug in ('hotel-saint-louis','hampton-inn-gateway-arch','21c-museum-hotel');
