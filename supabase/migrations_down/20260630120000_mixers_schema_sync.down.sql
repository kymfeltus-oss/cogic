-- Rollback is partial — drops connection columns added by schema sync only.
ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_type_check;
ALTER TABLE public.mixers DROP CONSTRAINT IF EXISTS mixers_connection_status_check;

ALTER TABLE public.mixers
  ADD CONSTRAINT mixers_connection_status_check CHECK (
    connection_status IN ('connected', 'needs_attention', 'not_connected')
  );

NOTIFY pgrst, 'reload schema';
