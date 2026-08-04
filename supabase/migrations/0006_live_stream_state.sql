-- =============================================================================
-- Global live stream activator state (admin-controlled, realtime-synced)
-- Non-destructive: new table + RLS read policies only.
-- =============================================================================

CREATE TABLE public.live_stream_state (
  id            text        PRIMARY KEY,
  is_live       boolean     NOT NULL DEFAULT false,
  playback_url  text        NOT NULL,
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT live_stream_state_id_not_blank CHECK (char_length(trim(id)) > 0),
  CONSTRAINT live_stream_state_playback_url_not_blank CHECK (
    char_length(trim(playback_url)) > 0
  )
);

COMMENT ON TABLE public.live_stream_state IS
  'Singleton row(s) controlling HLS stage activation for the live room hub.';
COMMENT ON COLUMN public.live_stream_state.is_live IS
  'When true, authenticated viewers with stream access mount playback_url.';
COMMENT ON COLUMN public.live_stream_state.playback_url IS
  'Signed or public HLS manifest URL (.m3u8) for the active concert feed.';

INSERT INTO public.live_stream_state (id, is_live, playback_url)
VALUES (
  'current_event',
  false,
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.live_stream_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_stream_state FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_stream_state_select_authenticated ON public.live_stream_state;
CREATE POLICY live_stream_state_select_authenticated
  ON public.live_stream_state
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON public.live_stream_state FROM PUBLIC, anon;
GRANT SELECT ON public.live_stream_state TO authenticated;
GRANT ALL ON public.live_stream_state TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_stream_state;
