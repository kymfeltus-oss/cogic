-- Consolidated idempotent mixer schema sync (Ethernet/USB connection model)
-- Docs: docs/database-migrations.md | Checklist: docs/database-migration-checklist.md
-- Apply: npm run db:migrate -- supabase/migrations/20260630120000_mixers_schema_sync.sql
-- Verify: npm run db:verify:mixers

ALTER TABLE public.mixers
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS firmware_version text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS imported_setup_json jsonb,
  ADD COLUMN IF NOT EXISTS connection_config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS connection_type text NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS ethernet_ip_address text,
  ADD COLUMN IF NOT EXISTS usb_device_name text,
  ADD COLUMN IF NOT EXISTS usb_device_id text,
  ADD COLUMN IF NOT EXISTS last_connection_method text;

-- Legacy `firmware` column from earlier migrations → firmware_version
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mixers' AND column_name = 'firmware'
  ) THEN
    UPDATE public.mixers
    SET firmware_version = COALESCE(firmware_version, firmware)
    WHERE firmware_version IS NULL AND firmware IS NOT NULL;
  END IF;
END $$;

UPDATE public.mixers
SET
  ethernet_ip_address = COALESCE(ethernet_ip_address, NULLIF(ip_address, '')),
  connection_type = CASE
    WHEN connection_type IS NOT NULL AND connection_type <> 'unknown' THEN connection_type
    WHEN connection_status = 'connected' AND NULLIF(ip_address, '') IS NOT NULL THEN 'ethernet'
    WHEN connection_status = 'needs_attention' THEN 'manual'
    ELSE 'unknown'
  END
WHERE ethernet_ip_address IS NULL OR connection_type = 'unknown';

UPDATE public.mixers
SET
  manufacturer = COALESCE(
    manufacturer,
    CASE
      WHEN mixer_model ILIKE '%midas%' THEN 'Midas'
      WHEN mixer_model ILIKE '%allen%' THEN 'Allen & Heath'
      WHEN mixer_model ILIKE '%yamaha%' THEN 'Yamaha'
      WHEN mixer_model ILIKE '%behringer%' OR mixer_model ILIKE '%x32%' THEN 'Behringer'
      ELSE NULL
    END
  ),
  model = COALESCE(
    model,
    CASE
      WHEN mixer_model ILIKE '%m32%' THEN 'M32'
      WHEN mixer_model ILIKE '%x32%' THEN 'X32'
      ELSE NULLIF(mixer_model, '')
    END
  )
WHERE manufacturer IS NULL OR model IS NULL;

ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_status_check;
ALTER TABLE public.mixers
  ADD CONSTRAINT mixers_connection_status_check CHECK (
    connection_status IN ('connected', 'detected', 'needs_attention', 'not_connected', 'development')
  );

ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_type_check;
ALTER TABLE public.mixers
  ADD CONSTRAINT mixers_connection_type_check CHECK (
    connection_type IN ('ethernet', 'usb', 'both', 'manual', 'unknown')
  );

CREATE INDEX IF NOT EXISTS mixers_tenant_last_connected_idx
  ON public.mixers (tenant_id, last_connected_at DESC NULLS LAST);

COMMENT ON COLUMN public.mixers.tenant_id IS 'Church/tenant identifier (church_id in product terminology)';
COMMENT ON COLUMN public.mixers.ethernet_ip_address IS 'Network address for mixer control over Ethernet';
COMMENT ON COLUMN public.mixers.firmware_version IS 'Mixer firmware version from console or import';
COMMENT ON COLUMN public.mixers.imported_setup_json IS 'Persisted mixer configuration imported from console';

NOTIFY pgrst, 'reload schema';
