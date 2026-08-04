UPDATE public.streaming_destinations
SET live_status = CASE live_status
  WHEN 'preparing' THEN 'preparing_broadcast'
  WHEN 'ready' THEN 'connected'
  WHEN 'validating' THEN 'offline'
  WHEN 'error' THEN 'needs_attention'
  ELSE live_status
END
WHERE live_status IN ('preparing', 'ready', 'validating', 'error');

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_live_status_check;
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
