-- Additive seed: published St. Louis Getting Around guidance (real public info, not inventory).
-- LIVE MODE ONLY — no fake rates or provider inventory.

INSERT INTO public.travel_airports (
  program_key, iata_code, name, guidance, url, published, display_order
)
SELECT
  'cogic-stream-2026',
  'STL',
  'Lambert–St. Louis International Airport (STL)',
  E'Lambert–St. Louis International Airport (STL) is the primary airport for the 118th Holy Convocation.\n\nPlan ground transportation from STL to your official COGIC hotel. Allow extra time for baggage and traffic during Convocation week.',
  'https://www.flystl.com/',
  true,
  1
WHERE NOT EXISTS (
  SELECT 1 FROM public.travel_airports
  WHERE program_key = 'cogic-stream-2026' AND iata_code = 'STL'
);

INSERT INTO public.travel_transportation_options (
  program_key, kind, name, description, url, published, display_order
)
SELECT v.program_key, v.kind, v.name, v.description, v.url, v.published, v.display_order
FROM (
  VALUES
    (
      'cogic-stream-2026',
      'rideshare',
      'Rideshare & taxis',
      'Rideshare and taxi services operate at STL. Follow airport signage for designated pickup zones.',
      NULL,
      true,
      1
    ),
    (
      'cogic-stream-2026',
      'public_transit',
      'MetroLink / public transit',
      'St. Louis MetroLink and MetroBus serve the region. Confirm schedules and station access before travel.',
      'https://www.metrostlouis.org/',
      true,
      2
    ),
    (
      'cogic-stream-2026',
      'parking',
      'Airport & downtown parking',
      'Airport and downtown parking options vary by location. Confirm rates and overnight rules with your hotel or parking operator.',
      NULL,
      true,
      3
    )
) AS v(program_key, kind, name, description, url, published, display_order)
WHERE NOT EXISTS (
  SELECT 1 FROM public.travel_transportation_options t
  WHERE t.program_key = v.program_key AND t.name = v.name
);

NOTIFY pgrst, 'reload schema';
