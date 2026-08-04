-- Ops-selected event timezone for countdown schedule editing on /ops/countdown.

ALTER TABLE public.event_countdown_config
  ADD COLUMN IF NOT EXISTS schedule_timezone text;

UPDATE public.event_countdown_config
SET schedule_timezone = COALESCE(schedule_timezone, 'America/New_York')
WHERE event_id = '300-awakening';

ALTER TABLE public.event_countdown_config
  ALTER COLUMN schedule_timezone SET NOT NULL,
  ALTER COLUMN schedule_timezone SET DEFAULT 'America/New_York';
