-- Standardize streaming_destinations.live_status enum
-- Rollback: supabase/migrations/20260708120000_streaming_live_status_enum.down.sql

UPDATE public.streaming_destinations
SET live_status = CASE live_status
  WHEN 'connecting' THEN 'preparing'
  WHEN 'connected' THEN 'ready'
  WHEN 'preparing_broadcast' THEN 'preparing'
  WHEN 'going_live' THEN 'preparing'
  ELSE live_status
END
WHERE live_status IN ('connecting', 'connected', 'preparing_broadcast', 'going_live');

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_live_status_check;
ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_live_status_check CHECK (
    live_status IN (
      'offline',
      'validating',
      'ready',
      'needs_attention',
      'preparing',
      'live',
      'stopping',
      'error'
    )
  );

NOTIFY pgrst, 'reload schema';
