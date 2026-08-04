-- Rollback Phase 3B events foundation.

DROP TRIGGER IF EXISTS event_occurrences_validate_follow ON public.event_occurrences;
DROP FUNCTION IF EXISTS public.validate_occurrence_follow_relationship();

DROP TRIGGER IF EXISTS event_occurrences_set_updated_at ON public.event_occurrences;
DROP TABLE IF EXISTS public.event_occurrences;

DROP TRIGGER IF EXISTS events_set_updated_at ON public.events;
DROP TABLE IF EXISTS public.events;

-- Keep set_row_updated_at() if other tables may use it; drop only if unused.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    WHERE p.proname = 'set_row_updated_at'
  ) THEN
    DROP FUNCTION IF EXISTS public.set_row_updated_at();
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
