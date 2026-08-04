-- Production audio mix layer + AV sync (vMix-style optional mix on embedded base)

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS audio_mode text NOT NULL DEFAULT 'embedded_video',
  ADD COLUMN IF NOT EXISTS audio_mix_json jsonb NOT NULL DEFAULT '{"baseEmbedded":{"enabled":true,"label":"Embedded Audio from Video Source"},"sources":[]}'::jsonb,
  ADD COLUMN IF NOT EXISTS audio_delay_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_delay_ms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS sync_check_status text NOT NULL DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS sync_check_log_json jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_audio_mode_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_audio_mode_check CHECK (
    audio_mode IN (
      'embedded_video',
      'external_mix_only',
      'browser_microphone',
      'audio_interface',
      'obs_vmix_audio',
      'auto_detect'
    )
  );

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_sync_check_status_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_sync_check_status_check CHECK (
    sync_check_status IN (
      'not_checked',
      'in_sync',
      'drift_detected',
      'adjusted',
      'needs_attention'
    )
  );

COMMENT ON COLUMN public.services.audio_mode IS 'Production audio engine routing mode (embedded, browser mic, OBS/vMix, etc.).';
COMMENT ON COLUMN public.services.audio_mix_json IS 'Optional vMix-style mix sources layered on base embedded audio.';
