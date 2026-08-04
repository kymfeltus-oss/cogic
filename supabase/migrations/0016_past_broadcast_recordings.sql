-- =============================================================================
-- 0016_past_broadcast_recordings.sql
-- Archive metadata for Restream event recordings (ops replay directory).
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.past_broadcast_recordings (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_title        text        NOT NULL,
  restream_event_id   text        NOT NULL UNIQUE,
  recording_url       text,
  audio_only_url      text,
  broadcast_date      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  link_expires_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT past_broadcast_recordings_title_not_blank
    CHECK (char_length(trim(stream_title)) > 0),
  CONSTRAINT past_broadcast_recordings_event_id_not_blank
    CHECK (char_length(trim(restream_event_id)) > 0)
);

COMMENT ON TABLE public.past_broadcast_recordings IS
  'Restream cloud recording archive links synced after shows end (ops replay directory).';
COMMENT ON COLUMN public.past_broadcast_recordings.recording_url IS
  'Temporary Restream download URL for the primary video recording.';
COMMENT ON COLUMN public.past_broadcast_recordings.audio_only_url IS
  'Temporary Restream download URL for the isolated audio track.';
COMMENT ON COLUMN public.past_broadcast_recordings.link_expires_at IS
  'When Restream recording file metadata expires (download URLs may need refresh).';

CREATE INDEX IF NOT EXISTS past_broadcast_recordings_broadcast_date_idx
  ON public.past_broadcast_recordings (broadcast_date DESC);

ALTER TABLE public.past_broadcast_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_broadcast_recordings FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.past_broadcast_recordings FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.past_broadcast_recordings TO service_role;
