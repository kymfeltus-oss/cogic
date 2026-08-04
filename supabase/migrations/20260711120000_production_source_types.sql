-- Production source type + label fields (video/audio inputs separate from broadcast output)

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS primary_video_source_type text NOT NULL DEFAULT 'browser_camera',
  ADD COLUMN IF NOT EXISTS primary_audio_source_type text NOT NULL DEFAULT 'browser_microphone',
  ADD COLUMN IF NOT EXISTS primary_video_source_label text,
  ADD COLUMN IF NOT EXISTS primary_audio_source_label text;

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_primary_video_source_type_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_primary_video_source_type_check CHECK (
    primary_video_source_type IN (
      'browser_camera',
      'obs_virtual_camera',
      'vmix',
      'external_encoder',
      'canon_xa60',
      'camera_phone',
      'custom'
    )
  );

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_primary_audio_source_type_check;
ALTER TABLE public.services
  ADD CONSTRAINT services_primary_audio_source_type_check CHECK (
    primary_audio_source_type IN (
      'browser_microphone',
      'usb_microphone',
      'audio_interface',
      'obs_vmix_audio',
      'camera_audio',
      'phone_audio',
      'wireless_lavalier',
      'mixer_soundboard',
      'custom'
    )
  );

COMMENT ON COLUMN public.services.primary_video_source_type IS 'Production video input type (not broadcast destination).';
COMMENT ON COLUMN public.services.primary_audio_source_type IS 'Production audio input type (not broadcast destination).';
