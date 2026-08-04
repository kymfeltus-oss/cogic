-- Internet connections: full production schema (idempotent, preserves existing rows)
-- Rollback: supabase/migrations/20260702130000_internet_connections_schema.down.sql

CREATE TABLE IF NOT EXISTS public.internet_connections (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           text        NOT NULL DEFAULT '300-awakening',
  service_id          uuid        NOT NULL REFERENCES public.services (id) ON DELETE CASCADE,
  connection_name     text        NOT NULL DEFAULT 'Main Internet',
  is_backup           boolean     NOT NULL DEFAULT false,
  upload_strength     text        NOT NULL DEFAULT 'unknown',
  status              text        NOT NULL DEFAULT 'not_connected',
  last_test_at        timestamptz,
  last_test_mbps      numeric,
  created_at          timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at          timestamptz NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.internet_connections
  ADD COLUMN IF NOT EXISTS connection_type text DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS network_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ssid text,
  ADD COLUMN IF NOT EXISTS local_ip text,
  ADD COLUMN IF NOT EXISTS is_primary boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS download_mbps numeric,
  ADD COLUMN IF NOT EXISTS upload_mbps numeric,
  ADD COLUMN IF NOT EXISTS latency_ms numeric,
  ADD COLUMN IF NOT EXISTS packet_loss_percent numeric,
  ADD COLUMN IF NOT EXISTS stability_score numeric,
  ADD COLUMN IF NOT EXISTS streaming_quality text,
  ADD COLUMN IF NOT EXISTS last_tested_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS settings_json jsonb NOT NULL DEFAULT '{}'::jsonb;

UPDATE public.internet_connections
SET connection_type = 'unknown'
WHERE connection_type IS NULL;

UPDATE public.internet_connections
SET upload_mbps = last_test_mbps
WHERE upload_mbps IS NULL AND last_test_mbps IS NOT NULL;

UPDATE public.internet_connections
SET last_tested_at = last_test_at
WHERE last_tested_at IS NULL AND last_test_at IS NOT NULL;

UPDATE public.internet_connections
SET last_test_mbps = upload_mbps
WHERE last_test_mbps IS NULL AND upload_mbps IS NOT NULL;

UPDATE public.internet_connections
SET last_test_at = last_tested_at
WHERE last_test_at IS NULL AND last_tested_at IS NOT NULL;

UPDATE public.internet_connections
SET is_primary = NOT is_backup;

UPDATE public.internet_connections
SET network_name = COALESCE(NULLIF(network_name, ''), NULLIF(ssid, ''), connection_name)
WHERE network_name IS NULL OR network_name = '';

ALTER TABLE public.internet_connections
  ALTER COLUMN connection_type SET DEFAULT 'unknown';

ALTER TABLE public.internet_connections
  ALTER COLUMN connection_type SET NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'tenant_equipment_profiles'
  ) THEN
    ALTER TABLE public.tenant_equipment_profiles
      ADD COLUMN IF NOT EXISTS preferred_network_json jsonb NOT NULL DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'internet_status_check') THEN
    ALTER TABLE public.internet_connections DROP CONSTRAINT internet_status_check;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'internet_connection_type_check') THEN
    ALTER TABLE public.internet_connections DROP CONSTRAINT internet_connection_type_check;
  END IF;
END $$;

ALTER TABLE public.internet_connections
  ADD CONSTRAINT internet_connection_type_check CHECK (
    connection_type IN ('wifi', 'ethernet', 'cellular', 'manual', 'unknown')
  );

ALTER TABLE public.internet_connections
  ADD CONSTRAINT internet_status_check CHECK (
    status IN ('not_connected', 'connected', 'ready', 'needs_attention', 'error', 'unknown')
  );

CREATE INDEX IF NOT EXISTS internet_connections_service_idx
  ON public.internet_connections (service_id);

NOTIFY pgrst, 'reload schema';
