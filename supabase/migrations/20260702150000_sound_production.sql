-- Production sound device binding + live status (mirrors cameras_production)

ALTER TABLE public.sound_items
  ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'usb',
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS hardware_label text,
  ADD COLUMN IF NOT EXISTS device_index integer,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS sample_rate integer,
  ADD COLUMN IF NOT EXISTS channel_count integer,
  ADD COLUMN IF NOT EXISTS mixer_type text,
  ADD COLUMN IF NOT EXISTS mixer_ip text,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS health_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS levels_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.sound_items DROP CONSTRAINT IF EXISTS sound_items_connection_type_check;
ALTER TABLE public.sound_items
  ADD CONSTRAINT sound_items_connection_type_check CHECK (
    connection_type IN (
      'usb', 'ethernet_mixer', 'wasapi', 'coreaudio', 'asio', 'browser', 'unknown'
    )
  );

ALTER TABLE public.sound_items DROP CONSTRAINT IF EXISTS sound_items_live_status_check;
ALTER TABLE public.sound_items
  ADD CONSTRAINT sound_items_live_status_check CHECK (
    live_status IN (
      'offline', 'connecting', 'connected', 'testing', 'previewing', 'needs_attention'
    )
  );

ALTER TABLE public.mixers
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS health_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS scene_name text,
  ADD COLUMN IF NOT EXISTS channel_count integer,
  ADD COLUMN IF NOT EXISTS sample_rate integer;

ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_live_status_check;
ALTER TABLE public.mixers
  ADD CONSTRAINT mixers_live_status_check CHECK (
    live_status IN (
      'offline', 'connecting', 'connected', 'testing', 'previewing', 'needs_attention'
    )
  );

-- Retire development connection status — map existing rows to needs_attention
UPDATE public.mixers SET connection_status = 'needs_attention' WHERE connection_status = 'development';

ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_status_check;
ALTER TABLE public.mixers
  ADD CONSTRAINT mixers_connection_status_check CHECK (
    connection_status IN ('connected', 'needs_attention', 'not_connected', 'detected')
  );

CREATE INDEX IF NOT EXISTS sound_items_device_id_idx ON public.sound_items (service_id, device_id);
CREATE INDEX IF NOT EXISTS sound_items_connection_type_idx ON public.sound_items (connection_type);

NOTIFY pgrst, 'reload schema';
