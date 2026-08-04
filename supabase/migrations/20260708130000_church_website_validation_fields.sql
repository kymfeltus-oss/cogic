-- Church website destination persistence + validation metadata
-- Rollback: supabase/migrations/20260708130000_church_website_validation_fields.down.sql

ALTER TABLE public.streaming_destinations
  ADD COLUMN IF NOT EXISTS website_name text,
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS stream_page_url text,
  ADD COLUMN IF NOT EXISTS embed_method text,
  ADD COLUMN IF NOT EXISTS validation_status text NOT NULL DEFAULT 'not_validated',
  ADD COLUMN IF NOT EXISTS validation_reason text;

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_validation_status_check;
ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_validation_status_check CHECK (
    validation_status IN ('not_validated', 'ready', 'needs_attention', 'error')
  );

ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_embed_method_check;
ALTER TABLE public.streaming_destinations
  ADD CONSTRAINT streaming_destinations_embed_method_check CHECK (
    embed_method IS NULL OR embed_method IN ('iframe', 'link')
  );

-- Backfill church_website metadata from settings_json when present.
UPDATE public.streaming_destinations
SET
  website_name = COALESCE(settings_json->>'websiteName', website_name),
  website_url = COALESCE(settings_json->>'websiteUrl', website_url),
  stream_page_url = COALESCE(settings_json->>'streamPageUrl', stream_page_url),
  embed_method = COALESCE(settings_json->>'embedMethod', embed_method)
WHERE platform = 'church_website';

NOTIFY pgrst, 'reload schema';
