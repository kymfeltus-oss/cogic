-- Seed verified street addresses + WGS84 coordinates for official COGIC housing inventory.
-- Coordinates are property locations (not invented map offsets). Pins require non-null lat/long.

update public.travel_hotels
set
  address = '705 Olive Street',
  postal_code = '63101',
  latitude = 38.628607,
  longitude = -90.191533,
  map_url = 'https://www.openstreetmap.org/?mlat=38.628607&mlon=-90.191533#map=17/38.628607/-90.191533',
  updated_at = now()
where id = 'a0000000-0000-4000-8000-000000000001'
  and program_key = 'cogic-stream-2026';

update public.travel_hotels
set
  address = '333 Washington Avenue',
  postal_code = '63102',
  latitude = 38.62972,
  longitude = -90.18640,
  map_url = 'https://www.openstreetmap.org/?mlat=38.62972&mlon=-90.18640#map=17/38.62972/-90.18640',
  updated_at = now()
where id = 'a0000000-0000-4000-8000-000000000002'
  and program_key = 'cogic-stream-2026';

update public.travel_hotels
set
  address = '315 Chestnut Street',
  postal_code = '63102',
  latitude = 38.62620,
  longitude = -90.18770,
  map_url = 'https://www.openstreetmap.org/?mlat=38.62620&mlon=-90.18770#map=17/38.62620/-90.18770',
  updated_at = now()
where id = 'a0000000-0000-4000-8000-000000000003'
  and program_key = 'cogic-stream-2026';

update public.travel_hotels
set
  address = '1528 Locust Street',
  postal_code = '63103',
  latitude = 38.63160,
  longitude = -90.20250,
  map_url = 'https://www.openstreetmap.org/?mlat=38.63160&mlon=-90.20250#map=17/38.63160/-90.20250',
  updated_at = now()
where id = 'a0000000-0000-4000-8000-000000000004'
  and program_key = 'cogic-stream-2026';
