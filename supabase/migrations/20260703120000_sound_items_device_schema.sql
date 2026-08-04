-- Canonical production sound device columns for sound_items

ALTER TABLE public.sound_items
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS device_name text,
  ADD COLUMN IF NOT EXISTS device_label text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS connection_type text,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS sample_rate integer,
  ADD COLUMN IF NOT EXISTS channel_count integer,
  ADD COLUMN IF NOT EXISTS signal_present boolean,
  ADD COLUMN IF NOT EXISTS peak_level double precision,
  ADD COLUMN IF NOT EXISTS average_level double precision,
  ADD COLUMN IF NOT EXISTS clipping_detected boolean,
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS settings_json jsonb,
  ADD COLUMN IF NOT EXISTS hardware_label text,
  ADD COLUMN IF NOT EXISTS device_index integer,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS mixer_type text,
  ADD COLUMN IF NOT EXISTS mixer_ip text,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS live_status text,
  ADD COLUMN IF NOT EXISTS health_json jsonb,
  ADD COLUMN IF NOT EXISTS levels_json jsonb;

-- Defaults for new rows
ALTER TABLE public.sound_items ALTER COLUMN device_type SET DEFAULT 'microphone';
ALTER TABLE public.sound_items ALTER COLUMN signal_present SET DEFAULT false;
ALTER TABLE public.sound_items ALTER COLUMN clipping_detected SET DEFAULT false;
ALTER TABLE public.sound_items ALTER COLUMN settings_json SET DEFAULT '{}'::jsonb;
ALTER TABLE public.sound_items ALTER COLUMN health_json SET DEFAULT '{}'::jsonb;
ALTER TABLE public.sound_items ALTER COLUMN levels_json SET DEFAULT '{}'::jsonb;
ALTER TABLE public.sound_items ALTER COLUMN live_status SET DEFAULT 'offline';

UPDATE public.sound_items
SET
  device_name = COALESCE(device_name, name),
  device_label = COALESCE(device_label, hardware_label, name),
  device_id = COALESCE(device_id, device_id),
  connection_type = COALESCE(connection_type, 'unknown'),
  device_type = COALESCE(
    device_type,
    CASE category
      WHEN 'mixer' THEN 'mixer'
      WHEN 'choir_mic' THEN 'choir_group'
      WHEN 'band_input' THEN 'band_group'
      WHEN 'other' THEN 'manual'
      ELSE 'microphone'
    END
  ),
  last_tested_at = COALESCE(last_tested_at, last_test_at, last_successful_test_at),
  settings_json = COALESCE(NULLIF(settings_json, '{}'::jsonb), config_json, '{}'::jsonb),
  signal_present = COALESCE(
    signal_present,
    COALESCE((levels_json->>'signalPresent')::boolean, false)
  ),
  peak_level = COALESCE(peak_level, NULLIF(levels_json->>'peak', '')::double precision),
  average_level = COALESCE(average_level, NULLIF(levels_json->>'rms', '')::double precision),
  clipping_detected = COALESCE(
    clipping_detected,
    COALESCE((levels_json->>'clipping')::boolean, false)
  )
WHERE true;

-- Normalize legacy connection_type values
UPDATE public.sound_items
SET connection_type = CASE connection_type
  WHEN 'browser' THEN 'browser_microphone'
  WHEN 'usb' THEN 'usb_audio'
  WHEN 'wasapi' THEN 'usb_audio'
  WHEN 'coreaudio' THEN 'usb_audio'
  WHEN 'asio' THEN 'audio_interface'
  WHEN 'ethernet_mixer' THEN 'network_mixer'
  WHEN 'browser_microphone' THEN 'browser_microphone'
  WHEN 'usb_audio' THEN 'usb_audio'
  WHEN 'audio_interface' THEN 'audio_interface'
  WHEN 'network_mixer' THEN 'network_mixer'
  WHEN 'manual' THEN 'manual'
  ELSE 'unknown'
END
WHERE connection_type IS NOT NULL;

UPDATE public.sound_items SET connection_type = 'unknown' WHERE connection_type IS NULL;

-- Normalize legacy status values
UPDATE public.sound_items
SET status = CASE status
  WHEN 'unknown' THEN 'not_connected'
  WHEN 'ready' THEN 'ready'
  WHEN 'needs_attention' THEN 'needs_attention'
  WHEN 'not_connected' THEN 'not_connected'
  WHEN 'connected' THEN 'connected'
  WHEN 'error' THEN 'error'
  ELSE 'not_connected'
END;

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

ALTER TABLE public.sound_items DROP CONSTRAINT IF EXISTS sound_items_status_check;
ALTER TABLE public.sound_items
  ADD CONSTRAINT sound_items_status_check CHECK (
    status IN ('not_connected', 'connected', 'ready', 'needs_attention', 'error')
  );

ALTER TABLE public.sound_items DROP CONSTRAINT IF EXISTS sound_items_live_status_check;
ALTER TABLE public.sound_items
  ADD CONSTRAINT sound_items_live_status_check CHECK (
    live_status IN (
      'offline', 'connecting', 'connected', 'testing', 'previewing', 'needs_attention'
    )
  );

CREATE INDEX IF NOT EXISTS sound_items_device_id_idx ON public.sound_items (service_id, device_id);
CREATE INDEX IF NOT EXISTS sound_items_connection_type_idx ON public.sound_items (connection_type);
CREATE INDEX IF NOT EXISTS sound_items_last_tested_at_idx ON public.sound_items (service_id, last_tested_at DESC);

NOTIFY pgrst, 'reload schema';
