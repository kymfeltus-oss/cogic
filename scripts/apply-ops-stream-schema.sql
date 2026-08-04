-- Run once in Supabase Dashboard → SQL Editor
-- Adds ops stream columns required by /api/ops/stream-pull and /api/ops/stream-ingest

-- 0012
ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS updated_by text;

-- 0011 (partial — skip if already applied)
ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS active_source text DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS primary_playback_url text,
  ADD COLUMN IF NOT EXISTS backup_playback_url text;

UPDATE public.live_stream_state
SET active_source = COALESCE(active_source, CASE WHEN is_live = true THEN 'primary' ELSE 'offline' END)
WHERE id = 'current_event';

-- 0013
ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS primary_rtmp_ingest_url text,
  ADD COLUMN IF NOT EXISTS backup_rtmp_ingest_url text;

-- 0014
ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS primary_rtmp_pull_url text,
  ADD COLUMN IF NOT EXISTS backup_rtmp_pull_url text,
  ADD COLUMN IF NOT EXISTS camera_preview_hls_url text;

-- Ensure singleton row exists
INSERT INTO public.live_stream_state (id, is_live, playback_url)
VALUES (
  'current_event',
  false,
  'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8'
)
ON CONFLICT (id) DO NOTHING;
