-- Mixer connection type: Ethernet vs USB (distinct paths)
-- Rollback: supabase/migrations/20260629120000_mixer_connection_type.down.sql

ALTER TABLE public.mixers
  ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ethernet_ip_address text,
  ADD COLUMN IF NOT EXISTS usb_device_name text,
  ADD COLUMN IF NOT EXISTS usb_device_id text,
  ADD COLUMN IF NOT EXISTS last_connection_method text;

UPDATE public.mixers
SET
  ethernet_ip_address = COALESCE(ethernet_ip_address, NULLIF(ip_address, '')),
  connection_type = CASE
    WHEN connection_status = 'connected' AND NULLIF(ip_address, '') IS NOT NULL THEN 'ethernet'
    WHEN connection_status = 'needs_attention' THEN 'manual'
    ELSE 'unknown'
  END
WHERE connection_type = 'unknown';

ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_type_check;
ALTER TABLE public.mixers
  ADD CONSTRAINT mixers_connection_type_check CHECK (
    connection_type IN ('ethernet', 'usb', 'both', 'manual', 'unknown')
  );

NOTIFY pgrst, 'reload schema';
