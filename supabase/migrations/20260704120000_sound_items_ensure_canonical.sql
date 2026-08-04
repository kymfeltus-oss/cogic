-- Ensure canonical sound_items columns exist (safe to run on any environment)

ALTER TABLE public.sound_items
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS connection_type text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS device_type text DEFAULT 'microphone',
  ADD COLUMN IF NOT EXISTS sample_rate integer,
  ADD COLUMN IF NOT EXISTS channel_count integer,
  ADD COLUMN IF NOT EXISTS signal_present boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS peak_level double precision,
  ADD COLUMN IF NOT EXISTS average_level double precision,
  ADD COLUMN IF NOT EXISTS clipping_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS settings_json jsonb DEFAULT '{}'::jsonb;

UPDATE public.sound_items
SET
  device_name = COALESCE(device_name, name),
  device_label = COALESCE(device_label, name),
  connection_type = COALESCE(connection_type, 'unknown'),
  device_type = COALESCE(device_type, 'microphone'),
  settings_json = COALESCE(settings_json, config_json, '{}'::jsonb),
  signal_present = COALESCE(signal_present, false),
  clipping_detected = COALESCE(clipping_detected, false)
WHERE true;

UPDATE public.sound_items SET status = 'not_connected' WHERE status = 'unknown';

ALTER TABLE public.sound_items DROP CONSTRAINT IF EXISTS sound_items_status_check;
ALTER TABLE public.sound_items
  ADD CONSTRAINT sound_items_status_check CHECK (
    status IN ('not_connected', 'connected', 'ready', 'needs_attention', 'error', 'unknown')
  );

ALTER TABLE public.sound_items DROP CONSTRAINT IF EXISTS sound_items_connection_type_check;
ALTER TABLE public.sound_items
  ADD CONSTRAINT sound_items_connection_type_check CHECK (
    connection_type IN (
      'browser_microphone', 'usb_audio', 'audio_interface', 'network_mixer', 'manual', 'unknown'
    )
  );

ALTER TABLE public.sound_items DROP CONSTRAINT IF EXISTS sound_items_device_type_check;
ALTER TABLE public.sound_items
  ADD CONSTRAINT sound_items_device_type_check CHECK (
    device_type IN (
      'microphone', 'mixer', 'audio_interface', 'instrument_input', 'choir_group', 'band_group', 'manual'
    )
  );

NOTIFY pgrst, 'reload schema';
