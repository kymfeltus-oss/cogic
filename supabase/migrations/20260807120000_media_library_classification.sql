ALTER TABLE public.past_broadcast_recordings DROP CONSTRAINT IF EXISTS past_broadcast_recordings_media_source_type_check;
ALTER TABLE public.past_broadcast_recordings ADD CONSTRAINT past_broadcast_recordings_media_source_type_check CHECK (media_source_type IN ('ivs_recording','manual_upload','external_url','imported_recording'));
ALTER TABLE public.past_broadcast_recordings
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'REPLAY',
  ADD COLUMN IF NOT EXISTS short_description text,
  ADD COLUMN IF NOT EXISTS speaker_name text,
  ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS publication_destinations text[] NOT NULL DEFAULT ARRAY['REPLAY_LIBRARY']::text[],
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS original_filename text,
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.past_broadcast_recordings DROP CONSTRAINT IF EXISTS past_broadcast_recordings_content_type_check;
ALTER TABLE public.past_broadcast_recordings ADD CONSTRAINT past_broadcast_recordings_content_type_check CHECK (content_type IN ('REPLAY','PRE_PRODUCTION','PROMO','LEADERSHIP_MESSAGE','INTERVIEW','EVENT_PREVIEW','DEVOTIONAL','ANNOUNCEMENT_VIDEO','HISTORICAL','OTHER'));
ALTER TABLE public.past_broadcast_recordings DROP CONSTRAINT IF EXISTS past_broadcast_recordings_destinations_check;
ALTER TABLE public.past_broadcast_recordings ADD CONSTRAINT past_broadcast_recordings_destinations_check CHECK (publication_destinations <@ ARRAY['HOME','LIVE_HUB','REPLAY_LIBRARY','EVENT_DETAIL','ANNOUNCEMENT']::text[]);
CREATE INDEX IF NOT EXISTS media_library_filters_idx ON public.past_broadcast_recordings(content_type,media_source_type,publication_status,featured,updated_at DESC);
COMMENT ON COLUMN public.past_broadcast_recordings.content_type IS 'Editorial classification, separate from source provenance.';
