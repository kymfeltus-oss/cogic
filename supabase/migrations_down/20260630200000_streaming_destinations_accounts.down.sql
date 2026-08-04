ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_connection_status_check;
ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_platform_check;

ALTER TABLE public.streaming_destinations
  DROP COLUMN IF EXISTS account_name,
  DROP COLUMN IF EXISTS account_email,
  DROP COLUMN IF EXISTS connection_status,
  DROP COLUMN IF EXISTS selected_for_today,
  DROP COLUMN IF EXISTS last_checked_at,
  DROP COLUMN IF EXISTS last_successful_test_at,
  DROP COLUMN IF EXISTS last_error_message,
  DROP COLUMN IF EXISTS oauth_access_token_encrypted,
  DROP COLUMN IF EXISTS oauth_refresh_token_encrypted,
  DROP COLUMN IF EXISTS oauth_expires_at,
  DROP COLUMN IF EXISTS stream_url_encrypted,
  DROP COLUMN IF EXISTS stream_key_encrypted,
  DROP COLUMN IF EXISTS backup_stream_url_encrypted,
  DROP COLUMN IF EXISTS settings_json;

ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_status_check CHECK (
    status IN ('ready', 'needs_attention', 'not_connected', 'unknown')
  );

NOTIFY pgrst, 'reload schema';
