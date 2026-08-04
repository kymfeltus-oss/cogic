-- =============================================================================
-- 0013_stream_rtmp_ingest_urls.sql
-- Operator RTMP push ingest URLs (OBS / mobile / vMix outbound) — ops-only.
-- =============================================================================

ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS primary_rtmp_ingest_url text,
  ADD COLUMN IF NOT EXISTS backup_rtmp_ingest_url text;

COMMENT ON COLUMN public.live_stream_state.primary_rtmp_ingest_url IS
  'Primary RTMP ingest endpoint for camera/OBS push (rtmp:// or rtmps://). Ops-only — never attendee playback.';
COMMENT ON COLUMN public.live_stream_state.backup_rtmp_ingest_url IS
  'Backup RTMP ingest endpoint for failover encoder push. Ops-only.';
