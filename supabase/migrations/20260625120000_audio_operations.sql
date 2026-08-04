-- =============================================================================
-- Audio Operations — X32 mappings, snapshots, settings, automation
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.audio_settings (
  tenant_id                         text        PRIMARY KEY DEFAULT '300-awakening',
  x32_ip                            text        NOT NULL DEFAULT '',
  x32_osc_port                      integer     NOT NULL DEFAULT 10023,
  connection_timeout_ms             integer     NOT NULL DEFAULT 5000,
  meter_refresh_rate_ms             integer     NOT NULL DEFAULT 100,
  lufs_target                       numeric     NOT NULL DEFAULT -14,
  true_peak_ceiling                 numeric     NOT NULL DEFAULT -1,
  feedback_sensitivity              numeric     NOT NULL DEFAULT 0.65,
  wireless_battery_warning_pct      integer     NOT NULL DEFAULT 25,
  wireless_battery_critical_pct     integer     NOT NULL DEFAULT 10,
  stream_silence_threshold_db       numeric     NOT NULL DEFAULT -50,
  recording_silence_threshold_db    numeric     NOT NULL DEFAULT -50,
  auto_create_incidents             boolean     NOT NULL DEFAULT true,
  auto_apply_scene_snapshots        boolean     NOT NULL DEFAULT false,
  enable_automation_rules           boolean     NOT NULL DEFAULT true,
  enable_health_check_before_go_live boolean    NOT NULL DEFAULT true,
  enable_talkback_controls          boolean     NOT NULL DEFAULT true,
  enable_audit_logging              boolean     NOT NULL DEFAULT true,
  console_display_name              text        NOT NULL DEFAULT 'X32 — Church Main Console',
  updated_at                        timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_by                        uuid        REFERENCES auth.users (id) ON DELETE SET NULL
);

INSERT INTO public.audio_settings (tenant_id)
VALUES ('300-awakening')
ON CONFLICT (tenant_id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.audio_channel_mappings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  x32_channel     integer     NOT NULL,
  display_name    text        NOT NULL DEFAULT '',
  role_key        text,
  wireless        boolean     NOT NULL DEFAULT false,
  wireless_channel text,
  backup_available boolean    NOT NULL DEFAULT false,
  group_key       text,
  threshold_db    numeric,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT audio_channel_mappings_channel_range CHECK (x32_channel BETWEEN 1 AND 32),
  CONSTRAINT audio_channel_mappings_tenant_channel_unique UNIQUE (tenant_id, x32_channel)
);

CREATE INDEX IF NOT EXISTS audio_channel_mappings_tenant_idx
  ON public.audio_channel_mappings (tenant_id);

CREATE TABLE IF NOT EXISTS public.audio_bus_mappings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  bus_key         text        NOT NULL,
  x32_target      text        NOT NULL,
  display_name    text        NOT NULL,
  output_role     text,
  limiter_enabled boolean     NOT NULL DEFAULT false,
  health_threshold_db numeric,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT audio_bus_mappings_tenant_bus_unique UNIQUE (tenant_id, bus_key)
);

CREATE TABLE IF NOT EXISTS public.audio_scene_mappings (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  production_scene text       NOT NULL,
  x32_scene_index integer     NOT NULL,
  x32_scene_name  text        NOT NULL DEFAULT '',
  description     text        NOT NULL DEFAULT '',
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT audio_scene_mappings_tenant_scene_unique UNIQUE (tenant_id, production_scene)
);

CREATE TABLE IF NOT EXISTS public.audio_snapshots (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  name            text        NOT NULL,
  mapped_scene    text,
  description     text        NOT NULL DEFAULT '',
  payload_json    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  is_preshow_default boolean  NOT NULL DEFAULT false,
  is_go_live_default boolean  NOT NULL DEFAULT false,
  last_used_at    timestamptz,
  status          text        NOT NULL DEFAULT 'ready',
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT audio_snapshots_status_check CHECK (status IN ('ready', 'archived', 'error'))
);

CREATE INDEX IF NOT EXISTS audio_snapshots_tenant_idx
  ON public.audio_snapshots (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.audio_automation_rules (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       text        NOT NULL DEFAULT '300-awakening',
  name            text        NOT NULL,
  trigger_type    text        NOT NULL,
  trigger_config  jsonb       NOT NULL DEFAULT '{}'::jsonb,
  action_type     text        NOT NULL,
  action_config   jsonb       NOT NULL DEFAULT '{}'::jsonb,
  enabled         boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Extend incident source enum for audio-specific sources
ALTER TABLE public.incident_events DROP CONSTRAINT IF EXISTS incident_events_source_check;
ALTER TABLE public.incident_events ADD CONSTRAINT incident_events_source_check CHECK (
  source IN (
    'console', 'preshow', 'camera', 'worker', 'ffmpeg', 'destination',
    'recording', 'auth', 'system', 'api_gateway',
    'x32', 'wireless', 'feedback', 'loudness', 'delay',
    'stream_audio', 'recording_audio', 'automation'
  )
);

ALTER TABLE public.audio_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_channel_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_bus_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_scene_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audio_automation_rules ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.audio_settings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.audio_channel_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.audio_bus_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.audio_scene_mappings FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.audio_snapshots FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.audio_automation_rules FROM PUBLIC, anon, authenticated;

GRANT ALL ON public.audio_settings TO service_role;
GRANT ALL ON public.audio_channel_mappings TO service_role;
GRANT ALL ON public.audio_bus_mappings TO service_role;
GRANT ALL ON public.audio_scene_mappings TO service_role;
GRANT ALL ON public.audio_snapshots TO service_role;
GRANT ALL ON public.audio_automation_rules TO service_role;

COMMENT ON TABLE public.audio_settings IS 'Parable Audio Operations — X32 connection and monitoring thresholds.';
COMMENT ON TABLE public.audio_channel_mappings IS 'Logical channel roles mapped to X32 input numbers.';
