-- Interactive audience polls (A/B) — separate from chat_messages / Fellowship Chat.

CREATE TABLE IF NOT EXISTS public.live_polls (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question text NOT NULL CHECK (char_length(trim(question)) BETWEEN 1 AND 280),
  option_a text NOT NULL CHECK (char_length(trim(option_a)) BETWEEN 1 AND 120),
  option_b text NOT NULL CHECK (char_length(trim(option_b)) BETWEEN 1 AND 120),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.live_poll_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id uuid NOT NULL REFERENCES public.live_polls (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  vote_choice char(1) NOT NULL CHECK (vote_choice IN ('A', 'B')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT unique_user_poll_instance_vote UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_live_polls_active
  ON public.live_polls (created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_live_poll_votes_lookup
  ON public.live_poll_votes (poll_id, vote_choice);

ALTER TABLE public.live_polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_poll_votes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.live_polls FROM PUBLIC;
REVOKE ALL ON public.live_poll_votes FROM PUBLIC;

GRANT SELECT ON public.live_polls TO anon, authenticated;
GRANT SELECT ON public.live_poll_votes TO authenticated;

GRANT ALL ON public.live_polls TO service_role;
GRANT ALL ON public.live_poll_votes TO service_role;

DROP POLICY IF EXISTS live_polls_select_active ON public.live_polls;
CREATE POLICY live_polls_select_active
  ON public.live_polls
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

DROP POLICY IF EXISTS live_poll_votes_select_self ON public.live_poll_votes;
CREATE POLICY live_poll_votes_select_self
  ON public.live_poll_votes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Writes via Next.js API routes using service_role only.

COMMENT ON TABLE public.live_polls IS
  'Ops-managed A/B audience polls — one active poll surfaced to /experience/live.';

COMMENT ON TABLE public.live_poll_votes IS
  'One vote per user per poll — inserted via POST /api/experience/polls/vote.';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_polls;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'live_polls already in supabase_realtime publication';
    END;

    BEGIN
      ALTER PUBLICATION supabase_realtime ADD TABLE public.live_poll_votes;
    EXCEPTION
      WHEN duplicate_object THEN
        RAISE NOTICE 'live_poll_votes already in supabase_realtime publication';
    END;
  END IF;
END $$;
