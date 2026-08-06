-- =============================================================================
-- 20260801120800_events_and_event_occurrences.sql
-- COGIC STREAM — Event + occurrence foundation (Phase 3B)
-- Target project: cogic (wjlaaluonxiaxmytiqwi)
-- Historical note: this migration originated in the predecessor project.
-- Does not modify live_stream_state, chat, reactions, or commerce.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.set_row_updated_at() IS
  'Generic BEFORE UPDATE trigger helper — sets updated_at to UTC now().';

-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.events (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key  text        NOT NULL DEFAULT 'cogic-stream-2026',
  slug         text        NOT NULL,
  title        text        NOT NULL,
  event_type   text        NOT NULL,
  description  text        NULL,
  status       text        NOT NULL DEFAULT 'draft',
  sort_order   integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by   uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by   uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT events_program_key_not_blank CHECK (char_length(trim(program_key)) > 0),
  CONSTRAINT events_slug_not_blank CHECK (char_length(trim(slug)) > 0),
  CONSTRAINT events_title_not_blank CHECK (char_length(trim(title)) > 0),
  CONSTRAINT events_program_slug_unique UNIQUE (program_key, slug),
  CONSTRAINT events_event_type_check CHECK (
    event_type IN (
      'main_service',
      'revival_fire',
      'midnight_musical',
      'main_event_center_class',
      'morning_manna',
      'midday_worship',
      'special_event'
    )
  ),
  CONSTRAINT events_status_check CHECK (
    status IN ('draft', 'published', 'archived')
  )
);

COMMENT ON TABLE public.events IS
  'Logical Convocation event catalog (Evening Worship, Revival Fire, etc.).';
COMMENT ON COLUMN public.events.program_key IS
  'Program/season scope key. 2026 Convocation uses cogic-stream-2026.';

CREATE INDEX IF NOT EXISTS events_program_key_event_type_idx
  ON public.events (program_key, event_type);
CREATE INDEX IF NOT EXISTS events_program_key_status_idx
  ON public.events (program_key, status);

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
CREATE TRIGGER events_set_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- ---------------------------------------------------------------------------
-- event_occurrences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.event_occurrences (
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id               uuid        NOT NULL REFERENCES public.events (id) ON DELETE RESTRICT,
  title_override         text        NULL,
  status                 text        NOT NULL DEFAULT 'scheduled',
  visibility             text        NOT NULL DEFAULT 'unpublished',
  timezone               text        NOT NULL DEFAULT 'America/Chicago',
  local_date             date        NOT NULL,
  scheduled_start_at     timestamptz NULL,
  estimated_start_at     timestamptz NULL,
  scheduled_end_at       timestamptz NULL,
  venue_label            text        NULL,
  follows_occurrence_id  uuid        NULL REFERENCES public.event_occurrences (id) ON DELETE RESTRICT,
  start_mode             text        NOT NULL DEFAULT 'fixed',
  broadcast_state_id     text        NULL,
  replay_recording_id    uuid        NULL,
  created_at             timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at             timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by             uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by             uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT event_occurrences_status_check CHECK (
    status IN (
      'scheduled',
      'starting_soon',
      'next',
      'live',
      'delayed',
      'completed',
      'canceled'
    )
  ),
  CONSTRAINT event_occurrences_visibility_check CHECK (
    visibility IN ('unpublished', 'published')
  ),
  CONSTRAINT event_occurrences_start_mode_check CHECK (
    start_mode IN ('fixed', 'after_predecessor')
  ),
  CONSTRAINT event_occurrences_fixed_requires_start CHECK (
    start_mode <> 'fixed' OR scheduled_start_at IS NOT NULL
  ),
  CONSTRAINT event_occurrences_after_requires_follow CHECK (
    start_mode <> 'after_predecessor' OR follows_occurrence_id IS NOT NULL
  ),
  CONSTRAINT event_occurrences_no_self_follow CHECK (
    follows_occurrence_id IS NULL OR follows_occurrence_id <> id
  ),
  CONSTRAINT event_occurrences_end_after_start CHECK (
    scheduled_start_at IS NULL
    OR scheduled_end_at IS NULL
    OR scheduled_end_at > scheduled_start_at
  )
);

COMMENT ON TABLE public.event_occurrences IS
  'Dated Convocation schedule instances. Broadcast linkage is a soft text ref to live_stream_state.id.';
COMMENT ON COLUMN public.event_occurrences.broadcast_state_id IS
  'Soft reference to public.live_stream_state.id (no hard FK in Phase 3B).';
COMMENT ON COLUMN public.event_occurrences.replay_recording_id IS
  'Soft reference to public.past_broadcast_recordings.id (no hard FK in Phase 3B).';
COMMENT ON COLUMN public.event_occurrences.follows_occurrence_id IS
  'For Revival Fire after_predecessor: must reference a main_service occurrence.';

CREATE INDEX IF NOT EXISTS event_occurrences_event_id_local_date_idx
  ON public.event_occurrences (event_id, local_date);
CREATE INDEX IF NOT EXISTS event_occurrences_local_date_scheduled_start_idx
  ON public.event_occurrences (local_date, scheduled_start_at);
CREATE INDEX IF NOT EXISTS event_occurrences_status_visibility_idx
  ON public.event_occurrences (status, visibility);
CREATE INDEX IF NOT EXISTS event_occurrences_follows_occurrence_id_idx
  ON public.event_occurrences (follows_occurrence_id)
  WHERE follows_occurrence_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS event_occurrences_broadcast_state_id_idx
  ON public.event_occurrences (broadcast_state_id)
  WHERE broadcast_state_id IS NOT NULL;

DROP TRIGGER IF EXISTS event_occurrences_set_updated_at ON public.event_occurrences;
CREATE TRIGGER event_occurrences_set_updated_at
  BEFORE UPDATE ON public.event_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- ---------------------------------------------------------------------------
-- Revival Fire must follow Evening Worship (main_service) only
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_occurrence_follow_relationship()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  follower_type text;
  predecessor_type text;
BEGIN
  IF NEW.follows_occurrence_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.follows_occurrence_id = NEW.id THEN
    RAISE EXCEPTION 'event_occurrences.follows_occurrence_id cannot reference itself';
  END IF;

  SELECT e.event_type
  INTO follower_type
  FROM public.events e
  WHERE e.id = NEW.event_id;

  IF follower_type IS NULL THEN
    RAISE EXCEPTION 'event_occurrences.event_id must reference an existing event';
  END IF;

  SELECT e.event_type
  INTO predecessor_type
  FROM public.event_occurrences o
  JOIN public.events e ON e.id = o.event_id
  WHERE o.id = NEW.follows_occurrence_id;

  IF predecessor_type IS NULL THEN
    RAISE EXCEPTION 'follows_occurrence_id must reference an existing occurrence';
  END IF;

  IF follower_type = 'revival_fire' THEN
    IF NEW.start_mode = 'after_predecessor' AND predecessor_type IS DISTINCT FROM 'main_service' THEN
      RAISE EXCEPTION
        'revival_fire after_predecessor occurrences may only follow main_service occurrences';
    END IF;
  END IF;

  IF predecessor_type = 'midnight_musical' AND follower_type = 'revival_fire' THEN
    RAISE EXCEPTION 'revival_fire cannot follow midnight_musical';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_occurrences_validate_follow ON public.event_occurrences;
CREATE TRIGGER event_occurrences_validate_follow
  BEFORE INSERT OR UPDATE OF event_id, follows_occurrence_id, start_mode
  ON public.event_occurrences
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_occurrence_follow_relationship();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events FORCE ROW LEVEL SECURITY;

ALTER TABLE public.event_occurrences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_occurrences FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.events FROM PUBLIC;
REVOKE ALL ON public.event_occurrences FROM PUBLIC;

GRANT SELECT ON public.events TO anon, authenticated;
GRANT SELECT ON public.event_occurrences TO anon, authenticated;
GRANT ALL ON public.events TO service_role;
GRANT ALL ON public.event_occurrences TO service_role;

DROP POLICY IF EXISTS events_select_published ON public.events;
CREATE POLICY events_select_published
  ON public.events
  FOR SELECT
  TO anon, authenticated
  USING (status = 'published');

DROP POLICY IF EXISTS event_occurrences_select_published ON public.event_occurrences;
CREATE POLICY event_occurrences_select_published
  ON public.event_occurrences
  FOR SELECT
  TO anon, authenticated
  USING (visibility = 'published' AND status <> 'canceled');

-- ---------------------------------------------------------------------------
-- Seed: 2026 logical event catalog (draft — no fake schedules)
-- ---------------------------------------------------------------------------
INSERT INTO public.events (program_key, slug, title, event_type, status, sort_order, description)
VALUES
  ('cogic-stream-2026', 'morning-manna', 'Morning Manna', 'morning_manna', 'draft', 10,
   'Daytime morning worship gathering for the 118th Holy Convocation.'),
  ('cogic-stream-2026', 'midday-worship', 'Midday Worship', 'midday_worship', 'draft', 20,
   'Midday worship service during Convocation.'),
  ('cogic-stream-2026', 'evening-worship', 'Evening Worship', 'main_service', 'draft', 30,
   'Primary evening worship / main service.'),
  ('cogic-stream-2026', 'revival-fire', 'Revival Fire', 'revival_fire', 'draft', 40,
   'Nightly gathering after Evening Worship. Start may follow service completion.'),
  ('cogic-stream-2026', 'midnight-musical', 'Midnight Musical', 'midnight_musical', 'draft', 50,
   'Friday Midnight Musical — distinct from Revival Fire.'),
  ('cogic-stream-2026', 'main-event-center-classes', 'Main Event Center Classes', 'main_event_center_class', 'draft', 60,
   'Daytime classes held in the Main Event Center only (2026 scope).')
ON CONFLICT (program_key, slug) DO NOTHING;

NOTIFY pgrst, 'reload schema';
