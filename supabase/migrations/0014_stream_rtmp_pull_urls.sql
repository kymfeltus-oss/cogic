-- =============================================================================
-- 0014_stream_rtmp_pull_urls.sql
-- Operator RTMP pull URLs (vMix/OBS pull from Restream) + HLS camera preview.
-- =============================================================================

ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS primary_rtmp_pull_url text,
  ADD COLUMN IF NOT EXISTS backup_rtmp_pull_url text,
  ADD COLUMN IF NOT EXISTS camera_preview_hls_url text;

COMMENT ON COLUMN public.live_stream_state.primary_rtmp_pull_url IS
  'Primary RTMP pull combined link (rtmp://pull.restream.io/pull/...). Ops-only — for vMix/OBS pull ingest.';
COMMENT ON COLUMN public.live_stream_state.backup_rtmp_pull_url IS
  'Backup RTMP pull combined link for failover monitoring ingest.';
COMMENT ON COLUMN public.live_stream_state.camera_preview_hls_url IS
  'HLS .m3u8 URL for in-app camera feed monitoring (browser-safe preview).';
