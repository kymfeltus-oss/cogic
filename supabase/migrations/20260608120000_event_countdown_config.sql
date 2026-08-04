-- Admin-controlled hero / countdown configuration for the attendee dashboard.

CREATE TABLE IF NOT EXISTS public.event_countdown_config (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            text        NOT NULL UNIQUE,
  headline            text        NOT NULL,
  eyebrow             text        NOT NULL,
  subtitle            text        NOT NULL,
  start_time          timestamptz NOT NULL,
  end_time            timestamptz NOT NULL,
  status_label        text        NOT NULL,
  cta_label_waiting   text        NOT NULL,
  cta_label_live      text        NOT NULL,
  helper_text         text        NOT NULL,
  hero_background_url text        NOT NULL,
  countdown_frame_url text        NOT NULL,
  waiting_pill_url    text        NOT NULL,
  button_frame_url    text        NOT NULL,
  is_active           boolean     NOT NULL DEFAULT true,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT event_countdown_config_event_id_not_blank
    CHECK (char_length(trim(event_id)) > 0),
  CONSTRAINT event_countdown_config_time_order
    CHECK (end_time > start_time)
);

COMMENT ON TABLE public.event_countdown_config IS
  'Singleton-style hero countdown copy and asset paths for /dashboard.';

INSERT INTO public.event_countdown_config (
  event_id,
  headline,
  eyebrow,
  subtitle,
  start_time,
  end_time,
  status_label,
  cta_label_waiting,
  cta_label_live,
  helper_text,
  hero_background_url,
  countdown_frame_url,
  waiting_pill_url,
  button_frame_url,
  is_active
) VALUES (
  '300-awakening',
  'YOU''RE ALMOST LIVE',
  'LIVE RECORDING EXPERIENCE',
  'THE AWAKENING BEGINS SOON',
  '2026-06-07T19:30:00-05:00',
  '2026-06-07T23:30:00-05:00',
  'WAITING FOR LIVE SIGNAL',
  'WAITING FOR LIVE',
  'ENTER LIVE EXPERIENCE',
  'STAY CLOSE. THE EXPERIENCE WILL OPEN AUTOMATICALLY.',
  '/effects/hero-audience-banner.png',
  '/ui/countdown-frame.png',
  '/ui/waiting-live-signal-pill.png',
  '/ui/enter-live-button-frame.png',
  true
)
ON CONFLICT (event_id) DO NOTHING;

ALTER TABLE public.event_countdown_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_countdown_config FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_countdown_config FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.event_countdown_config TO service_role;
