ALTER TABLE public.mixers
  ADD COLUMN IF NOT EXISTS imported_setup_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS connection_config_json jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS mixers_tenant_last_connected_idx
  ON public.mixers (tenant_id, last_connected_at DESC NULLS LAST);
