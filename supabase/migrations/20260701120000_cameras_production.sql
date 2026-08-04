-- Production camera discovery + device binding
-- Rollback: supabase/migrations/20260701120000_cameras_production.down.sql

ALTER TABLE public.cameras
  ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'usb',
  ADD COLUMN IF NOT EXISTS device_id text,
  ADD COLUMN IF NOT EXISTS hardware_label text,
  ADD COLUMN IF NOT EXISTS device_index integer,
  ADD COLUMN IF NOT EXISTS network_url text,
  ADD COLUMN IF NOT EXISTS network_username text,
  ADD COLUMN IF NOT EXISTS network_password_encrypted text,
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_successful_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_error_message text,
  ADD COLUMN IF NOT EXISTS live_status text NOT NULL DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS settings_json jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.cameras DROP CONSTRAINT IF EXISTS cameras_connection_type_check;
ALTER TABLE public.cameras
  ADD CONSTRAINT cameras_connection_type_check CHECK (
    connection_type IN ('usb', 'capture_card', 'network', 'built_in')
  );

ALTER TABLE public.cameras DROP CONSTRAINT IF EXISTS cameras_live_status_check;
ALTER TABLE public.cameras
  ADD CONSTRAINT cameras_live_status_check CHECK (
    live_status IN ('offline', 'connecting', 'connected', 'previewing', 'testing', 'needs_attention')
  );

CREATE INDEX IF NOT EXISTS cameras_device_id_idx ON public.cameras (service_id, device_id);
CREATE INDEX IF NOT EXISTS cameras_connection_type_idx ON public.cameras (connection_type);

NOTIFY pgrst, 'reload schema';
