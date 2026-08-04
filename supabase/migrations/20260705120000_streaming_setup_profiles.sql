-- Streaming setup wizard profiles (video/audio/encoder/network + OAuth account metadata)
-- Rollback: supabase/migrations/20260705120000_streaming_setup_profiles.down.sql

ALTER TABLE public.streaming_destinations
  ADD COLUMN IF NOT EXISTS channel_id text,
  ADD COLUMN IF NOT EXISTS channel_name text,
  ADD COLUMN IF NOT EXISTS profile_image_url text,
  ADD COLUMN IF NOT EXISTS oauth_permissions_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS last_authenticated_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_stream_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_category text,
  ADD COLUMN IF NOT EXISTS scheduled_start_at timestamptz,
  ADD COLUMN IF NOT EXISTS stream_tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS video_profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS encoder_profile_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS network_test_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS connection_quality text,
  ADD COLUMN IF NOT EXISTS latency_mode text;

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_connection_quality_check;
ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_connection_quality_check CHECK (
    connection_quality IS NULL
    OR connection_quality IN ('excellent', 'good', 'fair', 'poor', 'offline', 'unknown')
  );

NOTIFY pgrst, 'reload schema';
