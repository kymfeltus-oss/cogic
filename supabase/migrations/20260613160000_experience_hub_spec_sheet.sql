-- Spec-sheet asset paths and portal tabs for /experience hub.

ALTER TABLE public.experience_hub_settings
  ADD COLUMN IF NOT EXISTS backdrop_video_url text NOT NULL DEFAULT '/intro-video.mp4',
  ADD COLUMN IF NOT EXISTS backdrop_fallback_url text NOT NULL DEFAULT '/images/hub-bg.jpg';

CREATE TABLE IF NOT EXISTS public.experience_hub_portal_tabs (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         text        NOT NULL,
  tab_key          text        NOT NULL,
  category_label   text        NOT NULL,
  title            text        NOT NULL,
  body             text        NOT NULL,
  duration_label   text        NOT NULL,
  poster_url       text        NOT NULL,
  video_url        text        NOT NULL,
  cta_label        text        NOT NULL,
  cta_href         text        NOT NULL,
  sort_order       integer     NOT NULL DEFAULT 0,
  is_active        boolean     NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at       timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (event_id, tab_key)
);

UPDATE public.experience_hub_featured
SET
  poster_url = '/images/ian-thumbnail.jpg',
  video_url = '/intro-video.mp4'
WHERE event_id = '300-awakening';

UPDATE public.experience_hub_orbs
SET media_url = '/images/single-artwork.jpg'
WHERE event_id = '300-awakening' AND slug = 'single';

INSERT INTO public.experience_hub_portal_tabs (
  event_id,
  tab_key,
  category_label,
  title,
  body,
  duration_label,
  poster_url,
  video_url,
  cta_label,
  cta_href,
  sort_order,
  is_active
) VALUES (
  '300-awakening',
  'mission-story',
  'MISSION STORY',
  'Ian Craig''s 30+ Year Dialysis Journey',
  'Discover how decades of faith, endurance, and worship shaped the 300 Awakening movement — and why every voice in this room matters tonight.',
  '12:45',
  '/images/ian-thumbnail.jpg',
  '/intro-video.mp4',
  'WATCH FULL STORY',
  '/experience/music',
  1,
  true
)
ON CONFLICT (event_id, tab_key) DO UPDATE SET
  category_label = EXCLUDED.category_label,
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  duration_label = EXCLUDED.duration_label,
  poster_url = EXCLUDED.poster_url,
  video_url = EXCLUDED.video_url,
  cta_label = EXCLUDED.cta_label,
  cta_href = EXCLUDED.cta_href,
  sort_order = EXCLUDED.sort_order,
  is_active = EXCLUDED.is_active,
  updated_at = timezone('utc', now());

DELETE FROM public.experience_hub_ambient_tracks WHERE event_id = '300-awakening';

INSERT INTO public.experience_hub_ambient_tracks (
  event_id, title, audio_url, sort_order, is_active
) VALUES
  ('300-awakening', 'Ambient Worship', '/audio/worship-pad.mp3', 1, true),
  ('300-awakening', 'Ambient Worship II', '/intro-music.m4a', 2, true);

ALTER TABLE public.experience_hub_portal_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.experience_hub_portal_tabs FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.experience_hub_portal_tabs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.experience_hub_portal_tabs TO service_role;
