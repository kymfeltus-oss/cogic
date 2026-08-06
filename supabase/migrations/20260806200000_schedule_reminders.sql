-- Attendee schedule reminders against published event_occurrences.
-- Executed by Vercel Cron batch job — no per-attendee cron tasks.

CREATE TABLE IF NOT EXISTS public.schedule_reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  event_occurrence_id uuid NOT NULL REFERENCES public.event_occurrences (id) ON DELETE CASCADE,
  reminder_offset_minutes integer NOT NULL
    CHECK (reminder_offset_minutes IN (0, 15, 30)),
  due_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'canceled')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  sent_at timestamptz NULL,
  canceled_at timestamptz NULL,
  last_error text NULL,
  CONSTRAINT schedule_reminders_one_active_per_occurrence
    UNIQUE (user_id, event_occurrence_id)
);

CREATE INDEX IF NOT EXISTS schedule_reminders_due_pending_idx
  ON public.schedule_reminders (due_at ASC)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS schedule_reminders_user_idx
  ON public.schedule_reminders (user_id, status);

ALTER TABLE public.schedule_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schedule_reminders_own_select ON public.schedule_reminders;
CREATE POLICY schedule_reminders_own_select
  ON public.schedule_reminders FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS schedule_reminders_own_insert ON public.schedule_reminders;
CREATE POLICY schedule_reminders_own_insert
  ON public.schedule_reminders FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS schedule_reminders_own_update ON public.schedule_reminders;
CREATE POLICY schedule_reminders_own_update
  ON public.schedule_reminders FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS schedule_reminders_own_delete ON public.schedule_reminders;
CREATE POLICY schedule_reminders_own_delete
  ON public.schedule_reminders FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.schedule_reminders FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_reminders TO authenticated;
GRANT ALL ON public.schedule_reminders TO service_role;
