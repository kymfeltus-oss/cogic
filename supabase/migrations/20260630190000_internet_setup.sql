-- Internet setup: extended connection metrics + preferred church network
-- Rollback: supabase/migrations/20260630190000_internet_setup.down.sql

ALTER TABLE public.internet_connections
  ADD COLUMN IF NOT EXISTS connection_type text,
  ADD COLUMN IF NOT EXISTS ssid text,
  ADD COLUMN IF NOT EXISTS local_ip text,
  ADD COLUMN IF NOT EXISTS download_mbps numeric,
  ADD COLUMN IF NOT EXISTS latency_ms numeric,
  ADD COLUMN IF NOT EXISTS stability_score numeric,
  ADD COLUMN IF NOT EXISTS streaming_quality text;

ALTER TABLE public.tenant_equipment_profiles
  ADD COLUMN IF NOT EXISTS preferred_network_json jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.tenant_equipment_profiles.preferred_network_json IS
  'Remembered church network: { type, ssid, remember } — no passwords stored';

NOTIFY pgrst, 'reload schema';
