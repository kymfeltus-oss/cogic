ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_oauth_status_check;
ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_destination_status_check;

ALTER TABLE public.streaming_destinations
  DROP COLUMN IF EXISTS oauth_status,
  DROP COLUMN IF EXISTS permission_status,
  DROP COLUMN IF EXISTS quota_status,
  DROP COLUMN IF EXISTS live_permission_status,
  DROP COLUMN IF EXISTS rtmp_status,
  DROP COLUMN IF EXISTS destination_status,
  DROP COLUMN IF EXISTS last_validated_at,
  DROP COLUMN IF EXISTS last_successful_validation_at,
  DROP COLUMN IF EXISTS last_validation_error;

NOTIFY pgrst, 'reload schema';
