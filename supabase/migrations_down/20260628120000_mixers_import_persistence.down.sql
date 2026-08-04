-- Rollback for 20260628120000_mixers_import_persistence.sql
-- Run manually if you need to revert the mixers import persistence migration.

DROP INDEX IF EXISTS public.mixers_tenant_last_connected_idx;

ALTER TABLE public.mixers
  DROP COLUMN IF EXISTS imported_setup_json,
  DROP COLUMN IF EXISTS connection_config_json,
  DROP COLUMN IF EXISTS serial_number,
  DROP COLUMN IF EXISTS firmware,
  DROP COLUMN IF EXISTS model,
  DROP COLUMN IF EXISTS manufacturer;

NOTIFY pgrst, 'reload schema';
