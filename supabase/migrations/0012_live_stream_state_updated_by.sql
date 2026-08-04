-- =============================================================================
-- 0012_live_stream_state_updated_by.sql
-- Audit trail for administrative stream state mutations
-- =============================================================================

ALTER TABLE public.live_stream_state
  ADD COLUMN IF NOT EXISTS updated_by text;

COMMENT ON COLUMN public.live_stream_state.updated_by IS
  'Last mutator identity (e.g. operations_command_center).';
