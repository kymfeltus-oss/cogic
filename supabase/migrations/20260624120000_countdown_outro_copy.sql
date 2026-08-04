-- Admin-configurable outro copy when the show ends on /live and /countdown.

ALTER TABLE public.event_countdown_config
  ADD COLUMN IF NOT EXISTS outro_headline text,
  ADD COLUMN IF NOT EXISTS outro_subtitle text,
  ADD COLUMN IF NOT EXISTS outro_status_label text;

UPDATE public.event_countdown_config
SET
  outro_headline = COALESCE(outro_headline, 'THANK YOU FOR JOINING'),
  outro_subtitle = COALESCE(outro_subtitle, 'STAY CONNECTED FOR THE NEXT GATHERING.'),
  outro_status_label = COALESCE(outro_status_label, 'EVENT COMPLETE')
WHERE event_id = '300-awakening';

ALTER TABLE public.event_countdown_config
  ALTER COLUMN outro_headline SET NOT NULL,
  ALTER COLUMN outro_subtitle SET NOT NULL,
  ALTER COLUMN outro_status_label SET NOT NULL;

ALTER TABLE public.event_countdown_config
  ALTER COLUMN outro_headline SET DEFAULT 'THANK YOU FOR JOINING',
  ALTER COLUMN outro_subtitle SET DEFAULT 'STAY CONNECTED FOR THE NEXT GATHERING.',
  ALTER COLUMN outro_status_label SET DEFAULT 'EVENT COMPLETE';
