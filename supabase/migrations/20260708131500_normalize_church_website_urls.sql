-- Normalize church website URLs to https://
-- Rollback: supabase/migrations/20260708131500_normalize_church_website_urls.down.sql

UPDATE public.streaming_destinations
SET
  website_url = CASE
    WHEN website_url IS NULL OR btrim(website_url) = '' THEN website_url
    WHEN website_url ~* '^https?://' THEN website_url
    ELSE 'https://' || website_url
  END,
  stream_page_url = CASE
    WHEN stream_page_url IS NULL OR btrim(stream_page_url) = '' THEN stream_page_url
    WHEN stream_page_url ~* '^https?://' THEN stream_page_url
    ELSE 'https://' || stream_page_url
  END,
  settings_json = jsonb_strip_nulls(
    settings_json
    || jsonb_build_object(
      'websiteUrl',
      CASE
        WHEN COALESCE(settings_json->>'websiteUrl', '') = '' THEN NULL
        WHEN settings_json->>'websiteUrl' ~* '^https?://' THEN settings_json->>'websiteUrl'
        ELSE 'https://' || (settings_json->>'websiteUrl')
      END,
      'streamPageUrl',
      CASE
        WHEN COALESCE(settings_json->>'streamPageUrl', '') = '' THEN NULL
        WHEN settings_json->>'streamPageUrl' ~* '^https?://' THEN settings_json->>'streamPageUrl'
        ELSE 'https://' || (settings_json->>'streamPageUrl')
      END
    )
  ),
  updated_at = NOW()
WHERE platform = 'church_website';

NOTIFY pgrst, 'reload schema';
