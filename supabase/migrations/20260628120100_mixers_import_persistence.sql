-- Mixers import persistence: imported_setup_json + device metadata
-- tenant_id is the church/tenant identifier (church_id equivalent in app code)
-- Rollback: see supabase/migrations/20260628120000_mixers_import_persistence.down.sql

ALTER TABLE public.mixers
  ADD COLUMN IF NOT EXISTS manufacturer text,
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS firmware text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS imported_setup_json jsonb,
  ADD COLUMN IF NOT EXISTS connection_config_json jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Backfill manufacturer/model from legacy mixer_model slug when empty
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

CREATE INDEX IF NOT EXISTS mixers_tenant_last_connected_idx
  ON public.mixers (tenant_id, last_connected_at DESC NULLS LAST);

COMMENT ON COLUMN public.mixers.tenant_id IS 'Church/tenant identifier (church_id in product terminology)';
COMMENT ON COLUMN public.mixers.imported_setup_json IS 'Persisted mixer configuration imported from console';

-- Refresh PostgREST / Supabase schema cache
NOTIFY pgrst, 'reload schema';
