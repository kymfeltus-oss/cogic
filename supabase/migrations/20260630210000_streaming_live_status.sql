-- Live broadcast state per streaming destination
-- Rollback: supabase/migrations/20260630210000_streaming_live_status.down.sql

ALTER TABLE public.streaming_destinations
  ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS broadcast_external_id text,
  ADD COLUMN IF NOT EXISTS live_started_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_stopped_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_duration_seconds numeric;

UPDATE public.streaming_destinations
SET live_status = 'offline'
WHERE live_status IS NULL
   OR live_status NOT IN (
    'offline',
    'connecting',
    'connected',
    'preparing_broadcast',
    'going_live',
    'live',
    'stopping',
    'needs_attention'
   );

ALTER TABLE public.streaming_destinations
  DROP CONSTRAINT IF EXISTS streaming_destinations_live_status_check;

ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_live_status_check CHECK (
    live_status IN (
      'offline',
      'connecting',
      'connected',
      'preparing_broadcast',
      'going_live',
      'live',
      'stopping',
      'needs_attention'
    )
  );

NOTIFY pgrst, 'reload schema';
