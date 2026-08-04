ALTER TABLE public.streaming_destinations
  DROP COLUMN IF EXISTS channel_id,
  DROP COLUMN IF EXISTS channel_name,
  DROP COLUMN IF EXISTS profile_image_url,
  DROP COLUMN IF EXISTS oauth_permissions_json,
  DROP COLUMN IF EXISTS last_authenticated_at,
  DROP COLUMN IF EXISTS last_stream_at,
  DROP COLUMN IF EXISTS stream_category,
  DROP COLUMN IF EXISTS scheduled_start_at,
  DROP COLUMN IF EXISTS stream_tags,
  DROP COLUMN IF EXISTS video_profile_json,
  DROP COLUMN IF EXISTS audio_profile_json,
  DROP COLUMN IF EXISTS encoder_profile_json,
  DROP COLUMN IF EXISTS network_test_json,
  DROP COLUMN IF EXISTS connection_quality,
  DROP COLUMN IF EXISTS latency_mode;

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_connection_quality_check;

NOTIFY pgrst, 'reload schema';
