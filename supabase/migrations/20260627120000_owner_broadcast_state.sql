-- Owner broadcast state columns on live_stream_state singleton row.
ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS publish_mode text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS publish_status text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS playback_status text NOT NULL DEFAULT 'unconfigured',
  ADD COLUMN IF NOT EXISTS publish_error_message text,
  ADD COLUMN IF NOT EXISTS playback_error_message text,
  ADD COLUMN IF NOT EXISTS publisher_session_id text,
  ADD COLUMN IF NOT EXISTS publisher_channel text;

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

COMMENT ON COLUMN public.live_stream_state.publish_mode IS
  'Owner-selected publish pipeline: external_hls, rtmp_encoder, or browser_camera.';
COMMENT ON COLUMN public.live_stream_state.publish_status IS
  'Operator pipeline lifecycle — separate from attendee playback_status.';
COMMENT ON COLUMN public.live_stream_state.playback_status IS
  'Attendee-facing playback gate — includes playback_pending warm-up window.';
COMMENT ON COLUMN public.live_stream_state.publisher_channel IS
  'Supabase broadcast channel for browser_camera WebRTC signaling (no secrets).';
