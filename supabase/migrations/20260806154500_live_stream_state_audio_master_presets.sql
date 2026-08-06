-- Repair: active owner/show-setup code reads/writes live_stream_state.audio_master_presets
-- (jsonb) and related owner columns, but those columns were never present on
-- authoritative project wjlaaluonxiaxmytiqwi. Add minimum schema only — no seed rows.

ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS current_state text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS imminent_live_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS publish_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS playback_status text NOT NULL DEFAULT 'unconfigured',
  ADD COLUMN IF NOT EXISTS publish_error_message text,
  ADD COLUMN IF NOT EXISTS playback_error_message text,
  ADD COLUMN IF NOT EXISTS publisher_session_id text,
  ADD COLUMN IF NOT EXISTS publisher_channel text,
  ADD COLUMN IF NOT EXISTS concert_title text NOT NULL DEFAULT 'COGIC LIVE',
  ADD COLUMN IF NOT EXISTS headliner_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket_capacity_limit integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gates_locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audio_master_presets jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.live_stream_state
  DROP CONSTRAINT IF EXISTS live_stream_state_current_state_check;

ALTER TABLE public.live_stream_state
  ADD CONSTRAINT live_stream_state_current_state_check
  CHECK (current_state IN ('offline', 'scheduled', 'imminent_live', 'live'));

ALTER TABLE public.live_stream_state
  DROP CONSTRAINT IF EXISTS live_stream_state_publish_mode_check;

ALTER TABLE public.live_stream_state
  ADD CONSTRAINT live_stream_state_publish_mode_check
  CHECK (publish_mode IN ('none', 'external_hls', 'rtmp_encoder', 'browser_camera'));

ALTER TABLE public.live_stream_state
  DROP CONSTRAINT IF EXISTS live_stream_state_publish_status_check;

ALTER TABLE public.live_stream_state
  ADD CONSTRAINT live_stream_state_publish_status_check
  CHECK (
    publish_status IN ('offline', 'preflight', 'starting', 'publishing', 'ending', 'error')
  );

ALTER TABLE public.live_stream_state
  DROP CONSTRAINT IF EXISTS live_stream_state_playback_status_check;

ALTER TABLE public.live_stream_state
  ADD CONSTRAINT live_stream_state_playback_status_check
  CHECK (
    playback_status IN ('unconfigured', 'ready', 'playback_pending', 'live', 'error')
  );

COMMENT ON COLUMN public.live_stream_state.audio_master_presets IS
  'Operator JSON bag for show-setup and audio master presets (service-role writes).';
COMMENT ON COLUMN public.live_stream_state.current_state IS
  'Authoritative broadcast lifecycle: offline | scheduled | imminent_live | live.';
COMMENT ON COLUMN public.live_stream_state.concert_title IS
  'Operator show title used by owner setup and attendee surfaces.';
COMMENT ON COLUMN public.live_stream_state.headliner_name IS
  'Operator presenter/host label used by owner setup.';

NOTIFY pgrst, 'reload schema';
