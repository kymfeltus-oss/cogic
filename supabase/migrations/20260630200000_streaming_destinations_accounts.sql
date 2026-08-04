-- Streaming destinations as connected accounts (OAuth + encrypted secrets)
-- Rollback: supabase/migrations/20260630200000_streaming_destinations_accounts.down.sql

ALTER TABLE public.streaming_destinations
  ADD COLUMN IF NOT EXISTS account_name text,
  ADD COLUMN IF NOT EXISTS account_email text,
  ADD COLUMN IF NOT EXISTS connection_status text NOT NULL DEFAULT 'not_connected',
  ADD COLUMN IF NOT EXISTS selected_for_today boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_checked_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS oauth_access_token_encrypted text,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token_encrypted text,
  ADD COLUMN IF NOT EXISTS oauth_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_url_encrypted text,
  ADD COLUMN IF NOT EXISTS stream_key_encrypted text,
  ADD COLUMN IF NOT EXISTS backup_stream_url_encrypted text,
  ADD COLUMN IF NOT EXISTS settings_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill connection_status from legacy connected/status columns
UPDATE public.streaming_destinations
SET connection_status = CASE
  WHEN connected = true AND status = 'ready' THEN 'ready'
  WHEN connected = true THEN 'connected'
  WHEN status = 'needs_attention' THEN 'needs_attention'
  WHEN status = 'not_connected' THEN 'not_connected'
  ELSE 'not_connected'
END
WHERE connection_status = 'not_connected';

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_status_check;
ALTER TABLE public.streaming_destinations
  DROP CONSTRAINT IF EXISTS streaming_destinations_connection_status_check;
ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_connection_status_check CHECK (
    connection_status IN ('not_connected', 'connected', 'needs_attention', 'ready', 'error')
  );

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_platform_check;
ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_platform_check CHECK (
    platform IN ('youtube', 'facebook', 'church_website', 'vimeo', 'twitch', 'custom_rtmp', 'website', 'church_online')
  );

NOTIFY pgrst, 'reload schema';
