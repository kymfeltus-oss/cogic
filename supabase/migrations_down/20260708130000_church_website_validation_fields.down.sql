ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_embed_method_check;
ALTER TABLE public.streaming_destinations DROP CONSTRAINT IF EXISTS streaming_destinations_validation_status_check;

ALTER TABLE public.streaming_destinations
  DROP COLUMN IF EXISTS validation_reason,
  DROP COLUMN IF EXISTS validation_status,
  DROP COLUMN IF EXISTS embed_method,
  DROP COLUMN IF EXISTS stream_page_url,
  DROP COLUMN IF EXISTS website_url,
  DROP COLUMN IF EXISTS website_name;

NOTIFY pgrst, 'reload schema';
