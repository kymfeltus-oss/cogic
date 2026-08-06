-- Explicit publication lifecycle for real operator-managed recordings.
ALTER TABLE public.past_broadcast_recordings
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS thumbnail_url text,
  ADD COLUMN IF NOT EXISTS duration_seconds numeric(12,3),
  ADD COLUMN IF NOT EXISTS publication_status text NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS published_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.past_broadcast_recordings
  DROP CONSTRAINT IF EXISTS past_broadcast_recordings_publication_status_check;
ALTER TABLE public.past_broadcast_recordings
  ADD CONSTRAINT past_broadcast_recordings_publication_status_check
  CHECK (publication_status IN ('draft', 'processing', 'ready', 'published', 'unpublished', 'archived', 'failed'));

ALTER TABLE public.past_broadcast_recordings
  DROP CONSTRAINT IF EXISTS past_broadcast_recordings_duration_positive;
ALTER TABLE public.past_broadcast_recordings
  ADD CONSTRAINT past_broadcast_recordings_duration_positive
  CHECK (duration_seconds IS NULL OR duration_seconds > 0);

CREATE INDEX IF NOT EXISTS past_broadcast_recordings_publication_status_idx
  ON public.past_broadcast_recordings (publication_status, published_at DESC);

COMMENT ON COLUMN public.past_broadcast_recordings.publication_status IS
  'Operator-controlled media lifecycle; only published recordings are attendee-visible.';
