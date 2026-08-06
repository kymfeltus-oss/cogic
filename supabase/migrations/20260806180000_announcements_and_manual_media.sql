-- Announcements (in-app mass communication) + manual media upload provenance.
-- LIVE MODE ONLY — no seed announcement or demo video rows.

CREATE TABLE IF NOT EXISTS public.announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  title text NOT NULL,
  summary text NULL,
  body text NOT NULL,
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN (
      'general',
      'schedule',
      'venue',
      'transport',
      'safety',
      'leadership',
      'event'
    )),
  priority text NOT NULL DEFAULT 'normal'
    CHECK (priority IN ('normal', 'important', 'urgent')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'scheduled', 'published', 'expired', 'archived')),
  audience text NOT NULL DEFAULT 'all_authenticated'
    CHECK (audience IN (
      'all_authenticated',
      'registered_attendees',
      'program_all'
    )),
  pinned boolean NOT NULL DEFAULT false,
  event_occurrence_id uuid NULL REFERENCES public.event_occurrences (id) ON DELETE SET NULL,
  cta_label text NULL,
  cta_href text NULL,
  scheduled_at timestamptz NULL,
  published_at timestamptz NULL,
  expires_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT announcements_title_not_blank CHECK (char_length(btrim(title)) > 0),
  CONSTRAINT announcements_body_not_blank CHECK (char_length(btrim(body)) > 0),
  CONSTRAINT announcements_expire_after_publish CHECK (
    expires_at IS NULL OR published_at IS NULL OR expires_at > published_at
  )
);

CREATE INDEX IF NOT EXISTS announcements_program_status_idx
  ON public.announcements (program_key, status, published_at DESC);

CREATE INDEX IF NOT EXISTS announcements_pinned_idx
  ON public.announcements (pinned, published_at DESC)
  WHERE status = 'published';

CREATE TABLE IF NOT EXISTS public.announcement_reads (
  announcement_id uuid NOT NULL REFERENCES public.announcements (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (announcement_id, user_id)
);

CREATE INDEX IF NOT EXISTS announcement_reads_user_idx
  ON public.announcement_reads (user_id, read_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcement_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS announcements_public_select ON public.announcements;
CREATE POLICY announcements_public_select
  ON public.announcements
  FOR SELECT
  TO anon, authenticated
  USING (
    status = 'published'
    AND (published_at IS NULL OR published_at <= timezone('utc', now()))
    AND (expires_at IS NULL OR expires_at > timezone('utc', now()))
  );

DROP POLICY IF EXISTS announcement_reads_own_select ON public.announcement_reads;
CREATE POLICY announcement_reads_own_select
  ON public.announcement_reads
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS announcement_reads_own_insert ON public.announcement_reads;
CREATE POLICY announcement_reads_own_insert
  ON public.announcement_reads
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.announcements FROM PUBLIC;
REVOKE ALL ON public.announcement_reads FROM PUBLIC;
GRANT SELECT ON public.announcements TO anon, authenticated;
GRANT SELECT, INSERT ON public.announcement_reads TO authenticated;
GRANT ALL ON public.announcements TO service_role;
GRANT ALL ON public.announcement_reads TO service_role;

-- Manual upload provenance on replay recordings
ALTER TABLE public.past_broadcast_recordings
  ADD COLUMN IF NOT EXISTS media_source_type text NOT NULL DEFAULT 'external_url'
    CHECK (media_source_type IN ('ivs_recording', 'manual_upload', 'external_url')),
  ADD COLUMN IF NOT EXISTS storage_bucket text NULL,
  ADD COLUMN IF NOT EXISTS storage_path text NULL,
  ADD COLUMN IF NOT EXISTS upload_status text NULL
    CHECK (
      upload_status IS NULL
      OR upload_status IN ('uploading', 'processing', 'ready', 'failed')
    );

COMMENT ON COLUMN public.past_broadcast_recordings.media_source_type IS
  'Provenance of playable media: IVS recording, direct owner upload, or approved external URL.';

-- Private media uploads bucket (signed upload; public playback URL after ready)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media-uploads',
  'media-uploads',
  true,
  524288000,
  ARRAY['video/mp4', 'video/webm', 'video/quicktime']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read for playback URLs; writes only via service-role signed upload URLs.
DROP POLICY IF EXISTS media_uploads_public_read ON storage.objects;
CREATE POLICY media_uploads_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'media-uploads');

DROP POLICY IF EXISTS media_uploads_service_all ON storage.objects;
CREATE POLICY media_uploads_service_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'media-uploads')
  WITH CHECK (bucket_id = 'media-uploads');
