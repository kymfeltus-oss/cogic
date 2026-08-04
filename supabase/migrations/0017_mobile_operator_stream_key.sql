-- Mobile camera desk session key — labels phone uplink for director Cam 1 matching.

ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS mobile_operator_stream_key text;

COMMENT ON COLUMN public.live_stream_state.mobile_operator_stream_key IS
  'Active phone camera operator stream label (e.g. awakening_cam_operator_a7b2c9d4). Regenerated per camera-desk session.';
