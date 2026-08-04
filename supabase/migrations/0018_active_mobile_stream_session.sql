-- Phone camera desk session tracking (active key, client count, heartbeat).

ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS active_mobile_stream_key text,
  ADD COLUMN IF NOT EXISTS connected_phone_clients_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_mobile_ping_at timestamptz;

COMMENT ON COLUMN public.live_stream_state.active_mobile_stream_key IS
  'Active phone operator uplink label (e.g. awakening_phone_operator_a8f3a2b1). Regenerated per camera-desk session.';
COMMENT ON COLUMN public.live_stream_state.connected_phone_clients_count IS
  'Number of connected mobile camera desk clients for the current event.';
COMMENT ON COLUMN public.live_stream_state.last_mobile_ping_at IS
  'Last heartbeat from a mobile camera desk client.';

-- Backfill from legacy column when present (migration 0017).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'live_stream_state'
      AND column_name = 'mobile_operator_stream_key'
  ) THEN
    UPDATE public.live_stream_state
    SET active_mobile_stream_key = mobile_operator_stream_key
    WHERE active_mobile_stream_key IS NULL
      AND mobile_operator_stream_key IS NOT NULL;
  END IF;
END $$;
