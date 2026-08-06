-- =============================================================================
-- Convocation archives / media collections + donation source attribution
-- LIVE MODE ONLY — no seed/demo archive rows.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1) Convocation archives (year / number scoped by program_key)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.convocation_archives (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key          text        NOT NULL DEFAULT 'cogic-stream-2026',
  convocation_number   integer     NOT NULL,
  year                 integer     NOT NULL,
  slug                 text        NOT NULL,
  title                text        NOT NULL,
  description          text        NULL,
  published            boolean     NOT NULL DEFAULT false,
  sort_order           integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by           uuid        NULL,
  updated_by           uuid        NULL,

  CONSTRAINT convocation_archives_title_not_blank
    CHECK (char_length(trim(title)) > 0),
  CONSTRAINT convocation_archives_slug_not_blank
    CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT convocation_archives_year_range
    CHECK (year >= 1900 AND year <= 2100),
  CONSTRAINT convocation_archives_number_positive
    CHECK (convocation_number > 0),
  CONSTRAINT convocation_archives_program_slug_unique
    UNIQUE (program_key, slug),
  CONSTRAINT convocation_archives_program_year_unique
    UNIQUE (program_key, year)
);

COMMENT ON TABLE public.convocation_archives IS
  'Published COGIC Holy Convocation archive years (e.g. 118th — 2026).';

CREATE INDEX IF NOT EXISTS convocation_archives_program_published_idx
  ON public.convocation_archives (program_key, published, sort_order, year DESC);

-- ---------------------------------------------------------------------------
-- 2) Media collections within an archive
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_collections (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  archive_id           uuid        NOT NULL REFERENCES public.convocation_archives(id) ON DELETE CASCADE,
  program_key          text        NOT NULL DEFAULT 'cogic-stream-2026',
  key                  text        NOT NULL,
  slug                 text        NOT NULL,
  title                text        NOT NULL,
  description          text        NULL,
  published            boolean     NOT NULL DEFAULT false,
  sort_order           integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by           uuid        NULL,
  updated_by           uuid        NULL,

  CONSTRAINT media_collections_title_not_blank
    CHECK (char_length(trim(title)) > 0),
  CONSTRAINT media_collections_slug_not_blank
    CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT media_collections_key_not_blank
    CHECK (char_length(trim(key)) > 0),
  CONSTRAINT media_collections_archive_slug_unique
    UNIQUE (archive_id, slug),
  CONSTRAINT media_collections_archive_key_unique
    UNIQUE (archive_id, key)
);

COMMENT ON TABLE public.media_collections IS
  'Named media groupings within a Convocation archive (Revival Fire, Official Day, etc.).';

CREATE INDEX IF NOT EXISTS media_collections_archive_published_idx
  ON public.media_collections (archive_id, published, sort_order);

-- ---------------------------------------------------------------------------
-- 3) Recording ↔ collection assignment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.media_collection_recordings (
  collection_id        uuid        NOT NULL REFERENCES public.media_collections(id) ON DELETE CASCADE,
  recording_id         uuid        NOT NULL REFERENCES public.past_broadcast_recordings(id) ON DELETE CASCADE,
  sort_order           integer     NOT NULL DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by           uuid        NULL,
  PRIMARY KEY (collection_id, recording_id)
);

CREATE INDEX IF NOT EXISTS media_collection_recordings_recording_idx
  ON public.media_collection_recordings (recording_id);

-- ---------------------------------------------------------------------------
-- 4) Optional recording → archive direct link (year isolation helper)
-- ---------------------------------------------------------------------------
ALTER TABLE public.past_broadcast_recordings
  ADD COLUMN IF NOT EXISTS archive_id uuid NULL
    REFERENCES public.convocation_archives(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS past_broadcast_recordings_archive_idx
  ON public.past_broadcast_recordings (archive_id);

-- ---------------------------------------------------------------------------
-- 5) Donation source attribution columns (staged at checkout; webhook authoritative for paid)
-- ---------------------------------------------------------------------------
ALTER TABLE public.donations
  ADD COLUMN IF NOT EXISTS user_id uuid NULL,
  ADD COLUMN IF NOT EXISTS fund_key text NULL,
  ADD COLUMN IF NOT EXISTS source_type text NULL,
  ADD COLUMN IF NOT EXISTS source text NULL,
  ADD COLUMN IF NOT EXISTS program_key text NULL,
  ADD COLUMN IF NOT EXISTS media_id uuid NULL,
  ADD COLUMN IF NOT EXISTS event_id uuid NULL,
  ADD COLUMN IF NOT EXISTS event_occurrence_id uuid NULL,
  ADD COLUMN IF NOT EXISTS collection_id uuid NULL,
  ADD COLUMN IF NOT EXISTS attribution_json jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'donations_source_type_check'
  ) THEN
    ALTER TABLE public.donations
      ADD CONSTRAINT donations_source_type_check
      CHECK (
        source_type IS NULL OR source_type IN (
          'cogic_giving',
          'live',
          'replay',
          'event',
          'collection',
          'experience'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS donations_source_type_idx ON public.donations (source_type);
CREATE INDEX IF NOT EXISTS donations_media_id_idx ON public.donations (media_id);
CREATE INDEX IF NOT EXISTS donations_event_occurrence_id_idx ON public.donations (event_occurrence_id);
CREATE INDEX IF NOT EXISTS donations_collection_id_idx ON public.donations (collection_id);
CREATE INDEX IF NOT EXISTS donations_fund_key_idx ON public.donations (fund_key);

COMMENT ON COLUMN public.donations.source_type IS
  'Server-validated giving entry context (live/replay/event/collection/…).';
COMMENT ON COLUMN public.donations.media_id IS
  'Optional past_broadcast_recordings.id when giving from a replay.';
COMMENT ON COLUMN public.donations.attribution_json IS
  'Server-bound attribution snapshot mirrored from Stripe metadata at checkout.';

-- ---------------------------------------------------------------------------
-- 6) RLS — public read published archives/collections only; writes via service_role
-- ---------------------------------------------------------------------------
ALTER TABLE public.convocation_archives ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convocation_archives FORCE ROW LEVEL SECURITY;
ALTER TABLE public.media_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_collections FORCE ROW LEVEL SECURITY;
ALTER TABLE public.media_collection_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_collection_recordings FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.convocation_archives FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.media_collections FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.media_collection_recordings FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.convocation_archives TO anon, authenticated;
GRANT SELECT ON public.media_collections TO anon, authenticated;
GRANT SELECT ON public.media_collection_recordings TO anon, authenticated;
GRANT ALL ON public.convocation_archives TO service_role;
GRANT ALL ON public.media_collections TO service_role;
GRANT ALL ON public.media_collection_recordings TO service_role;

DROP POLICY IF EXISTS convocation_archives_public_select ON public.convocation_archives;
CREATE POLICY convocation_archives_public_select
  ON public.convocation_archives
  FOR SELECT
  TO anon, authenticated
  USING (published = true);

DROP POLICY IF EXISTS media_collections_public_select ON public.media_collections;
CREATE POLICY media_collections_public_select
  ON public.media_collections
  FOR SELECT
  TO anon, authenticated
  USING (
    published = true
    AND EXISTS (
      SELECT 1
      FROM public.convocation_archives a
      WHERE a.id = media_collections.archive_id
        AND a.published = true
    )
  );

DROP POLICY IF EXISTS media_collection_recordings_public_select ON public.media_collection_recordings;
CREATE POLICY media_collection_recordings_public_select
  ON public.media_collection_recordings
  FOR SELECT
  TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.media_collections c
      JOIN public.convocation_archives a ON a.id = c.archive_id
      JOIN public.past_broadcast_recordings r ON r.id = media_collection_recordings.recording_id
      WHERE c.id = media_collection_recordings.collection_id
        AND c.published = true
        AND a.published = true
        AND r.publication_status = 'published'
    )
  );

-- updated_at triggers (reuse shared helper when present)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_row_updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS convocation_archives_set_updated_at ON public.convocation_archives;
    CREATE TRIGGER convocation_archives_set_updated_at
      BEFORE UPDATE ON public.convocation_archives
      FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

    DROP TRIGGER IF EXISTS media_collections_set_updated_at ON public.media_collections;
    CREATE TRIGGER media_collections_set_updated_at
      BEFORE UPDATE ON public.media_collections
      FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
  END IF;
END $$;
