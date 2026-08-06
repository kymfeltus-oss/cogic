-- Provider-neutral production crews, broadcast sources, and occurrence assignments.
-- Contains metadata and secret-manager references only; never ingest credentials.

CREATE TABLE IF NOT EXISTS public.production_crews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  contact_name text NULL,
  contact_email text NULL,
  contact_phone text NULL,
  notes text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (program_key, name)
);

CREATE TABLE IF NOT EXISTS public.broadcast_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  crew_id uuid NOT NULL REFERENCES public.production_crews(id) ON DELETE RESTRICT,
  name text NOT NULL CHECK (char_length(trim(name)) > 0),
  provider text NOT NULL CHECK (provider IN ('ivs', 'restream', 'external')),
  channel_name text NULL,
  channel_reference text NULL,
  ingest_protocol text NOT NULL CHECK (ingest_protocol IN ('rtmps', 'srt')),
  ingest_config_ref text NULL,
  playback_configured boolean NOT NULL DEFAULT false,
  recording_configured boolean NOT NULL DEFAULT false,
  is_backup boolean NOT NULL DEFAULT false,
  priority integer NOT NULL DEFAULT 100 CHECK (priority >= 0),
  operational_status text NOT NULL DEFAULT 'offline'
    CHECK (operational_status IN ('offline', 'ready', 'live', 'degraded')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (crew_id, name)
);

CREATE TABLE IF NOT EXISTS public.event_broadcast_assignments (
  event_occurrence_id uuid PRIMARY KEY REFERENCES public.event_occurrences(id) ON DELETE CASCADE,
  primary_source_id uuid NOT NULL REFERENCES public.broadcast_sources(id) ON DELETE RESTRICT,
  backup_source_id uuid NULL REFERENCES public.broadcast_sources(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CHECK (backup_source_id IS NULL OR backup_source_id <> primary_source_id)
);

CREATE INDEX IF NOT EXISTS broadcast_sources_crew_active_idx
  ON public.broadcast_sources (crew_id, active, priority);
CREATE INDEX IF NOT EXISTS event_broadcast_assignments_primary_idx
  ON public.event_broadcast_assignments (primary_source_id);

DROP TRIGGER IF EXISTS production_crews_set_updated_at ON public.production_crews;
CREATE TRIGGER production_crews_set_updated_at BEFORE UPDATE ON public.production_crews
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
DROP TRIGGER IF EXISTS broadcast_sources_set_updated_at ON public.broadcast_sources;
CREATE TRIGGER broadcast_sources_set_updated_at BEFORE UPDATE ON public.broadcast_sources
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
DROP TRIGGER IF EXISTS event_broadcast_assignments_set_updated_at ON public.event_broadcast_assignments;
CREATE TRIGGER event_broadcast_assignments_set_updated_at BEFORE UPDATE ON public.event_broadcast_assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.production_crews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.broadcast_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_broadcast_assignments ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.production_crews, public.broadcast_sources, public.event_broadcast_assignments FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.production_crews, public.broadcast_sources, public.event_broadcast_assignments TO service_role;

COMMENT ON COLUMN public.broadcast_sources.ingest_config_ref IS
  'Opaque server-side secret-manager/environment profile reference; never a credential value.';
