ALTER TABLE public.internet_connections
  DROP COLUMN IF EXISTS network_name,
  DROP COLUMN IF EXISTS is_primary,
  DROP COLUMN IF EXISTS upload_mbps,
  DROP COLUMN IF EXISTS packet_loss_percent,
  DROP COLUMN IF EXISTS last_tested_at,
  DROP COLUMN IF EXISTS last_connected_at,
  DROP COLUMN IF EXISTS settings_json;

NOTIFY pgrst, 'reload schema';
