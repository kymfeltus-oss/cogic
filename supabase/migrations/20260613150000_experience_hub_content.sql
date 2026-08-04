-- Attendee /experience hub dynamic content (featured portal, orbs, ambient playlist, copy).

CREATE TABLE public.experience_hub_settings (
  event_id              text        PRIMARY KEY,
  welcome_prefix        text        NOT NULL,
  welcome_join_message  text        NOT NULL,
  brand_eyebrow         text        NOT NULL,
  brand_logo_url        text        NOT NULL,
  orbit_hint            text        NOT NULL,
  live_pill_label       text        NOT NULL,
  skyline_headline_live text        NOT NULL,
  skyline_subhead_live  text        NOT NULL,
  menu_href             text        NOT NULL,
  created_at            timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at            timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.experience_hub_featured (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        text        NOT NULL UNIQUE,
  category_label  text        NOT NULL,
  title           text        NOT NULL,
  body            text        NOT NULL,
  duration_label  text        NOT NULL,
  poster_url      text        NOT NULL,
  video_url       text        NOT NULL,
  cta_label       text        NOT NULL,
  cta_href        text        NOT NULL,
  is_active       boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE public.experience_hub_orbs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        NOT NULL,
  slug        text        NOT NULL,
  label       text        NOT NULL,
  subtext     text        NOT NULL,
  href        text        NOT NULL,
  icon_key    text        NOT NULL,
  accent      text        NOT NULL DEFAULT 'blue',
  media_url   text,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (event_id, slug)
);

CREATE TABLE public.experience_hub_ambient_tracks (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text        NOT NULL,
  title       text        NOT NULL,
  audio_url   text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.experience_hub_settings (
  event_id,
  welcome_prefix,
  welcome_join_message,
  brand_eyebrow,
  brand_logo_url,
  orbit_hint,
  live_pill_label,
  skyline_headline_live,
  skyline_subhead_live,
  menu_href
) VALUES (
  '300-awakening',
  'WELCOME',
  'WE''RE SO GLAD YOU JOINED US TODAY.',
  'IAN CRAIG AND',
  '/images/logoa.png',
  'TAP AN ORB TO EXPLORE',
  '((•)) LIVE NOW',
  'THE SANCTUARY STAGE IS OPEN',
  'JOIN THOUSANDS IN WORSHIP, UNITY AND IMPACT.',
  '/updates'
)
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO public.experience_hub_featured (
  event_id,
  category_label,
  title,
  body,
  duration_label,
  poster_url,
  video_url,
  cta_label,
  cta_href,
  is_active
) VALUES (
  '300-awakening',
  'MISSION STORY',
  'Ian Craig''s 30+ Year Dialysis Journey',
  'Discover how decades of faith, endurance, and worship shaped the 300 Awakening movement — and why every voice in this room matters tonight.',
  '12:45',
  '/effects/hero-audience-banner.png',
  '/intro-video.mp4',
  'WATCH FULL STORY',
  '/experience/music',
  true
)
ON CONFLICT (event_id) DO NOTHING;

INSERT INTO public.experience_hub_orbs (
  event_id, slug, label, subtext, href, icon_key, accent, media_url, sort_order, is_active
) VALUES
  ('300-awakening', 'giving', 'Vital Seed Giving', 'Every gift has a frequency.', '/experience/giving', 'giving', 'blue', NULL, 1, true),
  ('300-awakening', 'single', 'New Single Out Now', 'Support the mission. Download & share.', '/experience/music', 'single', 'pink', '/music/hallelujah-anyhow-cover.png', 2, true),
  ('300-awakening', 'connected', 'Stay Connected', 'Follow updates, events and mission news.', '/updates', 'connected', 'cyan', NULL, 3, true),
  ('300-awakening', 'encourage', 'Encourage Ian', 'Leave a public message of hope and strength.', '/experience/prayer', 'encourage', 'pink', NULL, 4, true)
ON CONFLICT (event_id, slug) DO NOTHING;

INSERT INTO public.experience_hub_ambient_tracks (
  event_id, title, audio_url, sort_order, is_active
) VALUES
  ('300-awakening', 'Ambient Worship', '/intro-music.m4a', 1, true)
ON CONFLICT DO NOTHING;

ALTER TABLE public.experience_hub_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_hub_featured ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_hub_orbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_hub_ambient_tracks ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.experience_hub_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.experience_hub_featured FORCE ROW LEVEL SECURITY;
ALTER TABLE public.experience_hub_orbs FORCE ROW LEVEL SECURITY;
ALTER TABLE public.experience_hub_ambient_tracks FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.experience_hub_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.experience_hub_featured FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.experience_hub_orbs FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.experience_hub_ambient_tracks FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.experience_hub_settings TO service_role;
GRANT ALL ON public.experience_hub_featured TO service_role;
GRANT ALL ON public.experience_hub_orbs TO service_role;
GRANT ALL ON public.experience_hub_ambient_tracks TO service_role;
