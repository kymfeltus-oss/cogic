-- Lightweight live reactions for attendee experience (separate from chat_messages)

CREATE TABLE IF NOT EXISTS public.live_stream_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reaction_type text NOT NULL CHECK (
    reaction_type IN ('fire', 'praise', 'heart', 'pray', 'seed')
  ),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS live_stream_reactions_created_at_idx
  ON public.live_stream_reactions (created_at DESC);

ALTER TABLE public.live_stream_reactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_stream_reactions_select ON public.live_stream_reactions;
CREATE POLICY live_stream_reactions_select
  ON public.live_stream_reactions
  FOR SELECT
  TO anon, authenticated
  USING (true);

REVOKE ALL ON public.live_stream_reactions FROM PUBLIC;
GRANT SELECT ON public.live_stream_reactions TO anon, authenticated;
GRANT ALL ON public.live_stream_reactions TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_reactions;

COMMENT ON TABLE public.live_stream_reactions IS
  'Ephemeral attendee live reactions — broadcast via Realtime; pruned by API after insert.';
