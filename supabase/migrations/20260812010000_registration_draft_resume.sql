-- Registration Hub Phase 1: early draft resume metadata + optimistic versions.
-- Preserves nullable draft inputs and stores server-owned wizard state.

-- Draft rows may omit country until the attendee completes identity fields.
ALTER TABLE public.registrations
  ALTER COLUMN country_code DROP NOT NULL;

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS draft_last_step text NULL,
  ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_draft_last_step_check;

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_draft_last_step_check
  CHECK (
    draft_last_step IS NULL
    OR draft_last_step IN (
      'attendee',
      'product',
      'group',
      'policy',
      'housing',
      'review',
      'payment'
    )
  );

ALTER TABLE public.registrations
  DROP CONSTRAINT IF EXISTS registrations_row_version_positive;

ALTER TABLE public.registrations
  ADD CONSTRAINT registrations_row_version_positive
  CHECK (row_version >= 1);

ALTER TABLE public.registration_groups
  ADD COLUMN IF NOT EXISTS wizard_resume_step integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS wizard_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS row_version integer NOT NULL DEFAULT 1;

ALTER TABLE public.registration_groups
  DROP CONSTRAINT IF EXISTS registration_groups_wizard_resume_step_check;

ALTER TABLE public.registration_groups
  ADD CONSTRAINT registration_groups_wizard_resume_step_check
  CHECK (wizard_resume_step >= 1 AND wizard_resume_step <= 8);

ALTER TABLE public.registration_groups
  DROP CONSTRAINT IF EXISTS registration_groups_row_version_positive;

ALTER TABLE public.registration_groups
  ADD CONSTRAINT registration_groups_row_version_positive
  CHECK (row_version >= 1);

COMMENT ON COLUMN public.registrations.draft_last_step IS
  'Last wizard step persisted for primary draft resume. Not authoritative for money or status.';
COMMENT ON COLUMN public.registrations.row_version IS
  'Optimistic concurrency token. Incremented on every registration mutation in lifecycle RPCs.';
COMMENT ON COLUMN public.registrations.registration_product_id IS
  'Nullable until product selection. Required before submit_registration_group when status IN (''submitted'', ''payment_pending'', ''confirmed'').';
COMMENT ON COLUMN public.registration_groups.wizard_resume_step IS
  'Server-derived wizard step (1-8). Recomputed from requirements; never trusted from client alone.';
COMMENT ON COLUMN public.registration_groups.wizard_metadata IS
  'Safe non-authoritative wizard hints. Money/status authority stays on registrations/payments.';
COMMENT ON COLUMN public.registration_groups.row_version IS
  'Optimistic concurrency token for atomic group transitions.';

-- Enforce product presence only once a registration leaves draft.
CREATE OR REPLACE FUNCTION public.validate_registration_product_for_non_draft()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'payment_pending', 'confirmed')
     AND NEW.registration_product_id IS NULL THEN
    RAISE EXCEPTION 'registration_product_id IS NULL is not allowed when status IN (''submitted'', ''payment_pending'', ''confirmed'')'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_validate_product_for_non_draft ON public.registrations;
CREATE TRIGGER registrations_validate_product_for_non_draft
  BEFORE INSERT OR UPDATE OF status, registration_product_id ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_registration_product_for_non_draft();

CREATE OR REPLACE FUNCTION public._registration_step_to_resume(p_step text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(COALESCE(p_step, '')))
    WHEN 'attendee' THEN 1
    WHEN 'product' THEN 2
    WHEN 'group' THEN 3
    WHEN 'policy' THEN 4
    WHEN 'housing' THEN 5
    WHEN 'review' THEN 6
    WHEN 'payment' THEN 7
    ELSE 1
  END;
$$;

CREATE OR REPLACE FUNCTION public.set_registration_group_wizard_resume(
  p_owner_user_id uuid,
  p_program_key text,
  p_resume_step integer,
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.registration_groups%ROWTYPE;
  v_step integer;
BEGIN
  IF p_owner_user_id IS NULL THEN
    RAISE EXCEPTION 'set_registration_group_wizard_resume requires owner_user_id'
      USING ERRCODE = 'check_violation';
  END IF;

  v_step := COALESCE(p_resume_step, 1);
  IF v_step < 1 OR v_step > 8 THEN
    RAISE EXCEPTION 'wizard_resume_step must be between 1 and 8 (got %)', v_step
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_group
  FROM public.registration_groups
  WHERE program_key = COALESCE(NULLIF(trim(p_program_key), ''), 'cogic-stream-2026')
    AND owner_user_id = p_owner_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration group not found for owner'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_group.status <> 'draft' THEN
    RAISE EXCEPTION 'wizard resume can only be updated while group is draft (status=%)', v_group.status
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.registration_groups
  SET
    wizard_resume_step = v_step,
    wizard_metadata = CASE
      WHEN p_metadata IS NULL THEN wizard_metadata
      ELSE COALESCE(wizard_metadata, '{}'::jsonb) || p_metadata
    END,
    row_version = row_version + 1,
    updated_at = timezone('utc', now())
  WHERE id = v_group.id
  RETURNING * INTO v_group;

  RETURN jsonb_build_object(
    'ok', true,
    'group_id', v_group.id,
    'wizard_resume_step', v_group.wizard_resume_step,
    'wizard_metadata', v_group.wizard_metadata,
    'group_version', v_group.row_version,
    'status', v_group.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.set_registration_group_wizard_resume(uuid, text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_registration_group_wizard_resume(uuid, text, integer, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_registration_group_wizard_resume(uuid, text, integer, jsonb) TO service_role;
