-- Attendee HLS playback URL for Today's Service → live_stream_state handoff
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS attendee_playback_hls_url text;

COMMENT ON COLUMN public.services.attendee_playback_hls_url IS
  'Restream (or CDN) HLS .m3u8 URL for attendee /live player — not RTMP ingest.';

ALTER TABLE public.stream_output_presets
  ADD COLUMN IF NOT EXISTS attendee_playback_hls_url text;

COMMENT ON COLUMN public.stream_output_presets.attendee_playback_hls_url IS
  'Per-method attendee HLS .m3u8 playback URL (custom_rtmp / obs_vmix).';
