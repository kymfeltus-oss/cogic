-- Streaming destination readiness validation status fields
-- Rollback: supabase/migrations/20260707120000_streaming_destination_validation.down.sql

ALTER TABLE public.streaming_destinations
  ADD COLUMN IF NOT EXISTS oauth_status text NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS permission_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS quota_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS live_permission_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS rtmp_status text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS destination_status text NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS last_validated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_validation_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_validation_error text;

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_oauth_status_check;
ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_oauth_status_check CHECK (
    oauth_status IN ('not_connected', 'connected', 'expired', 'refreshing', 'ready', 'error')
  );

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_destination_status_check;
ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_destination_status_check CHECK (
    destination_status IN ('not_connected', 'validating', 'ready', 'needs_attention', 'error', 'live', 'offline')
  );

UPDATE public.streaming_destinations
SET
  oauth_status = CASE
    WHEN connection_status = 'ready' THEN 'ready'
    WHEN connection_status = 'connected' THEN 'connected'
    WHEN connection_status = 'needs_attention' THEN 'error'
    WHEN connection_status = 'error' THEN 'error'
    ELSE 'not_connected'
  END,
  destination_status = CASE
    WHEN connection_status = 'ready' THEN 'ready'
    WHEN connection_status = 'needs_attention' THEN 'needs_attention'
    WHEN connection_status = 'error' THEN 'error'
    WHEN connection_status = 'connected' THEN 'needs_attention'
    ELSE 'not_connected'
  END,
  permission_status = CASE WHEN connection_status = 'ready' THEN 'granted' ELSE permission_status END,
  live_permission_status = CASE WHEN connection_status = 'ready' THEN 'enabled' ELSE live_permission_status END,
  rtmp_status = CASE WHEN connection_status = 'ready' THEN 'ready' ELSE rtmp_status END
WHERE destination_status = 'not_connected';

NOTIFY pgrst, 'reload schema';
