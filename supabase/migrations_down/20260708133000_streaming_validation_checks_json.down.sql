ALTER TABLE public.streaming_destinations
  DROP COLUMN IF EXISTS validation_checks_json;

NOTIFY pgrst, 'reload schema';
