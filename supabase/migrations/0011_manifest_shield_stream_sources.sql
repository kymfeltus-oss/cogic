-- =============================================================================
-- 0011_manifest_shield_stream_sources.sql
-- Dual-source live stream config + manifest access audit logging
-- =============================================================================

ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS active_source text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS primary_playback_url text,
  ADD COLUMN IF NOT EXISTS backup_playback_url text;

ALTER TABLE public.live_stream_state
  DROP CONSTRAINT IF EXISTS live_stream_state_active_source_check;

ALTER TABLE public.live_stream_state
  ADD CONSTRAINT live_stream_state_active_source_check
  CHECK (active_source IN ('offline', 'primary', 'backup'));

UPDATE public.live_stream_state
SET
  primary_playback_url = COALESCE(NULLIF(trim(primary_playback_url), ''), NULLIF(trim(playback_url), '')),
  active_source = CASE
    WHEN is_live = true THEN 'primary'
    ELSE 'offline'
  END
WHERE id = 'current_event';

COMMENT ON COLUMN public.live_stream_state.active_source IS
  'Server-selected manifest lane: offline | primary | backup';
COMMENT ON COLUMN public.live_stream_state.primary_playback_url IS
  'Primary upstream HLS manifest (.m3u8); never exposed directly to browsers.';
COMMENT ON COLUMN public.live_stream_state.backup_playback_url IS
  'Backup upstream HLS manifest (.m3u8); never exposed directly to browsers.';

CREATE TABLE IF NOT EXISTS public.stream_access_logs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  result     text        NOT NULL,
  reason     text        NOT NULL,
  ip         text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT stream_access_logs_result_check
    CHECK (result IN ('allowed', 'denied')),
  CONSTRAINT stream_access_logs_reason_not_blank
    CHECK (char_length(trim(reason)) > 0)
);

CREATE INDEX IF NOT EXISTS stream_access_logs_created_at_idx
  ON public.stream_access_logs (created_at DESC);

ALTER TABLE public.stream_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stream_access_logs FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.stream_access_logs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.stream_access_logs TO service_role;

DROP FUNCTION IF EXISTS public.log_stream_access(uuid, text, text, text, text);

CREATE OR REPLACE FUNCTION public.log_stream_access(
  p_user_id uuid,
  p_result text,
  p_reason text,
  p_ip text,
  p_user_agent text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.stream_access_logs (
    user_id,
    result,
    reason,
    ip,
    user_agent
  )
  VALUES (
    p_user_id,
    p_result,
    p_reason,
    NULLIF(trim(p_ip), ''),
    NULLIF(trim(p_user_agent), '')
  );
END;
$$;

REVOKE ALL ON FUNCTION public.log_stream_access(uuid, text, text, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.log_stream_access(uuid, text, text, text, text)
  TO service_role;
