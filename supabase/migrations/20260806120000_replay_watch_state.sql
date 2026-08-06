-- Persist authenticated replay progress, history, and favorites.
CREATE TABLE IF NOT EXISTS public.replay_watch_progress (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id uuid NOT NULL REFERENCES public.past_broadcast_recordings(id) ON DELETE CASCADE,
  last_position_seconds numeric(12,3) NOT NULL DEFAULT 0,
  duration_seconds numeric(12,3),
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, recording_id),
  CONSTRAINT replay_watch_progress_position_nonnegative CHECK (last_position_seconds >= 0),
  CONSTRAINT replay_watch_progress_duration_positive CHECK (duration_seconds IS NULL OR duration_seconds > 0)
);

CREATE INDEX IF NOT EXISTS replay_watch_progress_user_updated_idx
  ON public.replay_watch_progress (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.replay_favorites (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id uuid NOT NULL REFERENCES public.past_broadcast_recordings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (user_id, recording_id)
);

ALTER TABLE public.replay_watch_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_watch_progress FORCE ROW LEVEL SECURITY;
ALTER TABLE public.replay_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.replay_favorites FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.replay_watch_progress, public.replay_favorites FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.replay_watch_progress, public.replay_favorites TO authenticated;
GRANT ALL ON public.replay_watch_progress, public.replay_favorites TO service_role;

DROP POLICY IF EXISTS replay_watch_progress_owner ON public.replay_watch_progress;
CREATE POLICY replay_watch_progress_owner ON public.replay_watch_progress
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS replay_favorites_owner ON public.replay_favorites;
CREATE POLICY replay_favorites_owner ON public.replay_favorites
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP TRIGGER IF EXISTS replay_watch_progress_set_updated_at ON public.replay_watch_progress;
CREATE TRIGGER replay_watch_progress_set_updated_at
  BEFORE UPDATE ON public.replay_watch_progress
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
