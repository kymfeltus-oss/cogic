-- =============================================================================
-- 0015_add_studio_orchestration_mode.sql
-- Dual-engine studio orchestration: internal WebRTC vs Restream cloud bridge.
-- =============================================================================

ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS studio_engine_mode text NOT NULL DEFAULT 'restream_api';

COMMENT ON COLUMN public.live_stream_state.studio_engine_mode IS
  'Broadcast console engine: internal_studio (native WebRTC) or restream_api (cloud bridge).';

ALTER TABLE public.live_stream_state
  DROP CONSTRAINT IF EXISTS live_stream_state_studio_engine_mode_check;

ALTER TABLE public.live_stream_state
  ADD CONSTRAINT live_stream_state_studio_engine_mode_check
  CHECK (studio_engine_mode IN ('internal_studio', 'restream_api'));
