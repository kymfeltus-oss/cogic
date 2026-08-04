-- Persist provider validation check details for destination readiness
-- Rollback: supabase/migrations/20260708133000_streaming_validation_checks_json.down.sql

ALTER TABLE public.streaming_destinations
  ADD COLUMN IF NOT EXISTS validation_checks_json jsonb NOT NULL DEFAULT '[]'::jsonb;

NOTIFY pgrst, 'reload schema';
