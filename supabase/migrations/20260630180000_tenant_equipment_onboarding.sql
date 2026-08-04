-- Church equipment onboarding progress + remembered mixer connection preference
-- Rollback: supabase/migrations/20260630180000_tenant_equipment_onboarding.down.sql

CREATE TABLE IF NOT EXISTS public.tenant_equipment_profiles (
  tenant_id                   text        PRIMARY KEY,
  preferred_connection_type   text,
  remember_connection_choice  boolean     NOT NULL DEFAULT true,
  onboarding_json             jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at                  timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at                  timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.tenant_equipment_profiles IS 'Church-level equipment setup preferences and onboarding progress';
COMMENT ON COLUMN public.tenant_equipment_profiles.preferred_connection_type IS 'ethernet | usb | unsure — skipped on future setup when remember_connection_choice is true';

ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_status_check;
ALTER TABLE public.mixers
  ADD CONSTRAINT mixers_connection_status_check CHECK (
    connection_status IN ('connected', 'detected', 'needs_attention', 'not_connected', 'development')
  );

NOTIFY pgrst, 'reload schema';
