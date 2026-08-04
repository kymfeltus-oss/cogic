ALTER TABLE public.internet_connections
  DROP COLUMN IF EXISTS connection_type,
  DROP COLUMN IF EXISTS ssid,
  DROP COLUMN IF EXISTS local_ip,
  DROP COLUMN IF EXISTS download_mbps,
  DROP COLUMN IF EXISTS latency_ms,
  DROP COLUMN IF EXISTS stability_score,
  DROP COLUMN IF EXISTS streaming_quality;

ALTER TABLE public.tenant_equipment_profiles
  DROP COLUMN IF EXISTS preferred_network_json;

NOTIFY pgrst, 'reload schema';
