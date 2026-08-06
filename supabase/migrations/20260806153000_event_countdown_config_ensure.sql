-- Repair: historical countdown migrations are recorded as applied, but
-- public.event_countdown_config is missing from the live schema.
-- Recreate the minimum schema required by lib/live/fetch-countdown-config.ts
-- and lib/owner/show-setup-state.ts. No seed/demo countdown rows.

CREATE TABLE IF NOT EXISTS public.event_countdown_config (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            text        NOT NULL UNIQUE,
  headline            text        NOT NULL,
  eyebrow             text        NOT NULL,
  subtitle            text        NOT NULL,
  start_time          timestamptz NOT NULL,
  end_time            timestamptz NOT NULL,
  schedule_timezone   text        NOT NULL DEFAULT 'America/New_York',
  status_label        text        NOT NULL,
  cta_label_waiting   text        NOT NULL,
  cta_label_live      text        NOT NULL,
  helper_text         text        NOT NULL,
  outro_headline      text        NOT NULL DEFAULT 'THANK YOU FOR JOINING',
  outro_subtitle      text        NOT NULL DEFAULT 'STAY CONNECTED FOR THE NEXT GATHERING.',
  outro_status_label  text        NOT NULL DEFAULT 'EVENT COMPLETE',
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
  'Operator-controlled countdown schedule and copy for /countdown and show setup.';

ALTER TABLE public.event_countdown_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_countdown_config FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.event_countdown_config FROM PUBLIC;
REVOKE ALL ON public.event_countdown_config FROM anon;
REVOKE ALL ON public.event_countdown_config FROM authenticated;
GRANT ALL ON public.event_countdown_config TO service_role;

NOTIFY pgrst, 'reload schema';
