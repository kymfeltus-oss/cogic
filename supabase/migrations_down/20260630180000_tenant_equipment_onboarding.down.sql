DROP TABLE IF EXISTS public.tenant_equipment_profiles;

ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_status_check;
ALTER TABLE public.mixers
  ADD CONSTRAINT mixers_connection_status_check CHECK (
    connection_status IN ('connected', 'needs_attention', 'not_connected', 'development')
  );

NOTIFY pgrst, 'reload schema';
