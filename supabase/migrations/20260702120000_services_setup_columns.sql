-- Optional service metadata for church setup workflows (tenant_id = church scope)

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled';

ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'services_status_check'
  ) THEN
    ALTER TABLE public.services
      ADD CONSTRAINT services_status_check CHECK (
        status IN ('draft', 'scheduled', 'live', 'completed', 'cancelled')
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS services_active_tenant_date_idx
  ON public.services (tenant_id, service_date DESC)
  WHERE is_active = true;
