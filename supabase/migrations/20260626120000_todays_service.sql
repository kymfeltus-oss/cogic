-- =============================================================================
-- Today's Service — church volunteer pre-show setup & readiness
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.services (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL DEFAULT '300-awakening',
  service_name        text        NOT NULL DEFAULT 'Sunday Morning Service',
  service_date        date        NOT NULL DEFAULT CURRENT_DATE,
  service_start_time  time        NOT NULL DEFAULT '10:00',
  broadcast_profile   text        NOT NULL DEFAULT 'Standard',
  readiness_message   text        NOT NULL DEFAULT '',
  countdown_enabled   boolean     NOT NULL DEFAULT true,
  service_started_at  timestamptz,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT services_tenant_date_unique UNIQUE (tenant_id, service_date)
);

CREATE INDEX IF NOT EXISTS services_tenant_idx ON public.services (tenant_id);

CREATE TABLE IF NOT EXISTS public.service_equipment (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  service_id      uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  equipment_type  text        NOT NULL,
  name            text        NOT NULL,
  config_json     jsonb       NOT NULL DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'unknown',
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT service_equipment_type_check CHECK (
    equipment_type IN ('sound', 'camera', 'internet', 'streaming', 'recording', 'presentation', 'other')
  ),
  CONSTRAINT service_equipment_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS service_equipment_service_idx ON public.service_equipment (service_id);

CREATE TABLE IF NOT EXISTS public.sound_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  service_id      uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  category        text        NOT NULL DEFAULT 'other',
  name            text        NOT NULL,
  config_json     jsonb       NOT NULL DEFAULT '{}',
  status          text        NOT NULL DEFAULT 'unknown',
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT sound_items_category_check CHECK (
    category IN ('mixer', 'microphone', 'choir_mic', 'band_input', 'pastor_mic', 'livestream_audio', 'recording_audio', 'other')
  ),
  CONSTRAINT sound_items_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS sound_items_service_idx ON public.sound_items (service_id);

CREATE TABLE IF NOT EXISTS public.mixers (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL DEFAULT '300-awakening',
  service_id          uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  sound_item_id       uuid        REFERENCES public.sound_items (id) ON DELETE SET NULL,
  name                text        NOT NULL DEFAULT 'Main Mixer',
  mixer_model         text        NOT NULL DEFAULT 'behringer_x32',
  ip_address          text        NOT NULL DEFAULT '',
  connection_status   text        NOT NULL DEFAULT 'not_connected',
  last_connected_at   timestamptz,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT mixers_connection_status_check CHECK (
    connection_status IN ('connected', 'needs_attention', 'not_connected')
  )
);

CREATE INDEX IF NOT EXISTS mixers_service_idx ON public.mixers (service_id);

CREATE TABLE IF NOT EXISTS public.microphones (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  service_id      uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  sound_item_id   uuid        REFERENCES public.sound_items (id) ON DELETE SET NULL,
  name            text        NOT NULL,
  mic_type        text        NOT NULL DEFAULT 'wireless',
  battery_pct     integer,
  status          text        NOT NULL DEFAULT 'unknown',
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT microphones_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS microphones_service_idx ON public.microphones (service_id);

CREATE TABLE IF NOT EXISTS public.cameras (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  service_id      uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  name            text        NOT NULL,
  camera_type     text        NOT NULL DEFAULT 'fixed',
  location        text        NOT NULL DEFAULT '',
  preview_source  text        NOT NULL DEFAULT '',
  status          text        NOT NULL DEFAULT 'unknown',
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT cameras_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS cameras_service_idx ON public.cameras (service_id);

CREATE TABLE IF NOT EXISTS public.internet_connections (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL DEFAULT '300-awakening',
  service_id          uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  connection_name     text        NOT NULL DEFAULT 'Main Internet',
  is_backup           boolean     NOT NULL DEFAULT false,
  upload_strength     text        NOT NULL DEFAULT 'unknown',
  status              text        NOT NULL DEFAULT 'unknown',
  last_test_at        timestamptz,
  last_test_mbps      numeric,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT internet_upload_strength_check CHECK (
    upload_strength IN ('excellent', 'good', 'needs_attention', 'not_connected', 'unknown')
  ),
  CONSTRAINT internet_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS internet_connections_service_idx ON public.internet_connections (service_id);

CREATE TABLE IF NOT EXISTS public.streaming_destinations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL DEFAULT '300-awakening',
  service_id          uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  destination_name    text        NOT NULL,
  platform            text        NOT NULL DEFAULT 'youtube',
  connected           boolean     NOT NULL DEFAULT false,
  privacy             text        NOT NULL DEFAULT 'public',
  stream_title        text        NOT NULL DEFAULT '',
  stream_description  text        NOT NULL DEFAULT '',
  thumbnail_url       text        NOT NULL DEFAULT '',
  advanced_json       jsonb       NOT NULL DEFAULT '{}',
  status              text        NOT NULL DEFAULT 'unknown',
  sort_order          integer     NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT streaming_destinations_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS streaming_destinations_service_idx ON public.streaming_destinations (service_id);

CREATE TABLE IF NOT EXISTS public.recording_settings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL DEFAULT '300-awakening',
  service_id          uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  recording_enabled   boolean     NOT NULL DEFAULT false,
  recording_name      text        NOT NULL DEFAULT 'Service Recording',
  save_location       text        NOT NULL DEFAULT '',
  storage_remaining_gb numeric,
  backup_recording    boolean     NOT NULL DEFAULT false,
  status              text        NOT NULL DEFAULT 'unknown',
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT recording_settings_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS recording_settings_service_idx ON public.recording_settings (service_id);

CREATE TABLE IF NOT EXISTS public.presentation_sources (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL DEFAULT '300-awakening',
  service_id          uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  software_name       text        NOT NULL DEFAULT 'None',
  connection_status   text        NOT NULL DEFAULT 'not_connected',
  lyrics_loaded       boolean     NOT NULL DEFAULT false,
  slides_loaded       boolean     NOT NULL DEFAULT false,
  lower_thirds_enabled boolean    NOT NULL DEFAULT false,
  status              text        NOT NULL DEFAULT 'unknown',
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT presentation_sources_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  )
);

CREATE INDEX IF NOT EXISTS presentation_sources_service_idx ON public.presentation_sources (service_id);

CREATE TABLE IF NOT EXISTS public.service_timeline_items (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  service_id      uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  part_key        text        NOT NULL,
  label           text        NOT NULL,
  duration_minutes integer,
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS service_timeline_items_service_idx ON public.service_timeline_items (service_id);

CREATE TABLE IF NOT EXISTS public.team_members (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  service_id      uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  name            text        NOT NULL,
  role_key        text        NOT NULL DEFAULT 'volunteer',
  email           text        NOT NULL DEFAULT '',
  phone           text        NOT NULL DEFAULT '',
  sort_order      integer     NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT team_members_role_check CHECK (
    role_key IN ('producer', 'sound', 'cameras', 'slides', 'pastor', 'volunteer')
  )
);

CREATE INDEX IF NOT EXISTS team_members_service_idx ON public.team_members (service_id);

CREATE TABLE IF NOT EXISTS public.service_alerts (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  service_id      uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  message         text        NOT NULL,
  severity        text        NOT NULL DEFAULT 'warning',
  category        text        NOT NULL DEFAULT 'general',
  status          text        NOT NULL DEFAULT 'open',
  note            text        NOT NULL DEFAULT '',
  source_ref      text,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT service_alerts_severity_check CHECK (
    severity IN ('critical', 'warning', 'info')
  ),
  CONSTRAINT service_alerts_status_check CHECK (
    status IN ('open', 'ignored', 'fixed')
  )
);

CREATE INDEX IF NOT EXISTS service_alerts_service_idx ON public.service_alerts (service_id, status);

CREATE TABLE IF NOT EXISTS public.service_audit_log (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  service_id      uuid        REFERENCES public.services (id) ON DELETE SET NULL,
  user_id         uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  user_email      text,
  action          text        NOT NULL,
  detail_json     jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS service_audit_log_service_idx ON public.service_audit_log (service_id, created_at DESC);

-- RLS: service_role only (Next.js API routes)
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mixers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microphones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cameras ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.internet_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recording_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_timeline_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.services FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_equipment FORCE ROW LEVEL SECURITY;
ALTER TABLE public.sound_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.mixers FORCE ROW LEVEL SECURITY;
ALTER TABLE public.microphones FORCE ROW LEVEL SECURITY;
ALTER TABLE public.cameras FORCE ROW LEVEL SECURITY;
ALTER TABLE public.internet_connections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.streaming_destinations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.recording_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_sources FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_timeline_items FORCE ROW LEVEL SECURITY;
ALTER TABLE public.team_members FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_alerts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.service_audit_log FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.services FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.service_equipment FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.sound_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.mixers FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.microphones FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.cameras FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.internet_connections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.streaming_destinations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.recording_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.presentation_sources FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.service_timeline_items FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.team_members FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.service_alerts FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.service_audit_log FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.services TO service_role;
GRANT ALL ON public.service_equipment TO service_role;
GRANT ALL ON public.sound_items TO service_role;
GRANT ALL ON public.mixers TO service_role;
GRANT ALL ON public.microphones TO service_role;
GRANT ALL ON public.cameras TO service_role;
GRANT ALL ON public.internet_connections TO service_role;
GRANT ALL ON public.streaming_destinations TO service_role;
GRANT ALL ON public.recording_settings TO service_role;
GRANT ALL ON public.presentation_sources TO service_role;
GRANT ALL ON public.service_timeline_items TO service_role;
GRANT ALL ON public.team_members TO service_role;
GRANT ALL ON public.service_alerts TO service_role;
GRANT ALL ON public.service_audit_log TO service_role;

COMMENT ON TABLE public.services IS 'Today''s Service header and begin-service state per tenant/day';
