-- Registration Hub Phase 1: atomic multi-row lifecycle RPCs with row locks + version checks.

CREATE OR REPLACE FUNCTION public._registration_audit(
  p_action text,
  p_target_id uuid,
  p_user_id uuid,
  p_user_email text,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    tenant_id,
    user_id,
    user_email,
    action,
    target_type,
    target_id,
    metadata
  ) VALUES (
    '300-awakening',
    p_user_id,
    p_user_email,
    p_action,
    'registration',
    p_target_id::text,
    COALESCE(p_metadata, '{}'::jsonb) || jsonb_build_object('program_key', 'cogic-stream-2026')
  );
END;
$$;

REVOKE ALL ON FUNCTION public._registration_audit(text, uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._registration_audit(text, uuid, uuid, text, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public._registration_audit(text, uuid, uuid, text, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public._assert_registration_group_version(
  p_group public.registration_groups,
  p_expected_group_version integer
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  IF p_expected_group_version IS NOT NULL AND p_group.row_version <> p_expected_group_version THEN
    RAISE EXCEPTION 'registration group version conflict (expected %, actual %)',
      p_expected_group_version, p_group.row_version
      USING ERRCODE = 'serialization_failure';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public._assert_registration_member_versions(
  p_group_id uuid,
  p_expected_member_versions jsonb
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r RECORD;
  v_expected integer;
BEGIN
  IF p_expected_member_versions IS NULL OR jsonb_typeof(p_expected_member_versions) <> 'object' THEN
    RAISE EXCEPTION 'member version snapshot is missing member set'
      USING ERRCODE = 'serialization_failure';
  END IF;

  FOR r IN
    SELECT id, row_version
    FROM public.registrations
    WHERE registration_group_id = p_group_id
  LOOP
    IF NOT (p_expected_member_versions ? r.id::text) THEN
      RAISE EXCEPTION 'member version snapshot is missing member %', r.id
        USING ERRCODE = 'serialization_failure';
    END IF;
    v_expected := (p_expected_member_versions ->> r.id::text)::integer;
    IF v_expected IS DISTINCT FROM r.row_version THEN
      RAISE EXCEPTION 'registration member version conflict for % (expected %, actual %)',
        r.id, v_expected, r.row_version
        USING ERRCODE = 'serialization_failure';
    END IF;
  END LOOP;

  IF jsonb_object_length(p_expected_member_versions) <> (
    SELECT count(*) FROM public.registrations WHERE registration_group_id = p_group_id
  ) THEN
    RAISE EXCEPTION 'snapshot contains stale members'
      USING ERRCODE = 'serialization_failure';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- save_registration_primary_draft
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_registration_primary_draft(
  p_user_id uuid,
  p_program_key text,
  p_draft jsonb,
  p_expected_group_version integer DEFAULT NULL,
  p_expected_registration_version integer DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_program_key text := COALESCE(NULLIF(trim(p_program_key), ''), 'cogic-stream-2026');
  v_group public.registration_groups%ROWTYPE;
  v_primary public.registrations%ROWTYPE;
  v_first_name text;
  v_last_name text;
  v_email text;
  v_mobile text;
  v_street text;
  v_city text;
  v_postal text;
  v_country text;
  v_church text;
  v_pastor text;
  v_jurisdiction text;
  v_draft_step text;
  v_created boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'save_registration_primary_draft requires authenticated user_id'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_draft IS NULL OR jsonb_typeof(p_draft) <> 'object' THEN
    RAISE EXCEPTION 'save_registration_primary_draft requires a JSON object draft payload'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Reject client authority for money/status/ownership keys if present.
  IF p_draft ? 'amount_cents'
     OR p_draft ? 'status'
     OR p_draft ? 'user_id'
     OR p_draft ? 'owner_user_id'
     OR p_draft ? 'registration_product_id'
     OR p_draft ? 'total_cents'
  THEN
    RAISE EXCEPTION 'save_registration_primary_draft rejects client-supplied authority fields'
      USING ERRCODE = 'check_violation';
  END IF;

  v_first_name := nullif(trim(COALESCE(p_draft->>'first_name', '')), '');
  v_last_name := nullif(trim(COALESCE(p_draft->>'last_name', '')), '');
  v_email := lower(nullif(trim(COALESCE(p_draft->>'email', '')), ''));
  v_mobile := nullif(trim(COALESCE(p_draft->>'mobile_phone', '')), '');
  v_street := nullif(trim(COALESCE(p_draft->>'street_address', '')), '');
  v_city := nullif(trim(COALESCE(p_draft->>'city', '')), '');
  v_postal := nullif(trim(COALESCE(p_draft->>'postal_code', '')), '');
  v_country := COALESCE(nullif(trim(COALESCE(p_draft->>'country_code', '')), ''), 'US');
  v_church := nullif(trim(COALESCE(p_draft->>'church_name', '')), '');
  v_pastor := nullif(trim(COALESCE(p_draft->>'pastor_name', '')), '');
  v_jurisdiction := nullif(trim(COALESCE(p_draft->>'jurisdiction', '')), '');
  v_draft_step := lower(nullif(trim(COALESCE(p_draft->>'draft_last_step', '')), ''));

  IF v_draft_step IS NULL THEN
    v_draft_step := 'attendee';
  END IF;

  IF v_draft_step NOT IN ('attendee', 'product', 'group', 'policy', 'housing', 'review', 'payment') THEN
    RAISE EXCEPTION 'invalid draft_last_step %', v_draft_step
      USING ERRCODE = 'check_violation';
  END IF;

  -- Drafts are intentionally partial. Strict completeness is enforced only by
  -- submit_registration_group and the submitted-row database constraint.
  IF v_email IS NOT NULL AND v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'primary draft email is invalid'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.registration_groups (program_key, owner_user_id, status, wizard_resume_step)
  VALUES (v_program_key, p_user_id, 'draft', 1)
  ON CONFLICT (program_key, owner_user_id) DO NOTHING;

  SELECT *
  INTO v_group
  FROM public.registration_groups
  WHERE program_key = v_program_key
    AND owner_user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unable to create or lock registration group'
      USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM public._assert_registration_group_version(v_group, p_expected_group_version);

  IF v_group.status <> 'draft' THEN
    RAISE EXCEPTION 'registration group is not editable (status=%)', v_group.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_primary
  FROM public.registrations
  WHERE registration_group_id = v_group.id
    AND is_primary_registrant = true
  FOR UPDATE;

  IF FOUND THEN
    IF p_expected_registration_version IS NOT NULL
       AND v_primary.row_version <> p_expected_registration_version THEN
      RAISE EXCEPTION 'registration version conflict (expected %, actual %)',
        p_expected_registration_version, v_primary.row_version
        USING ERRCODE = 'serialization_failure';
    END IF;

    IF v_primary.status <> 'draft' THEN
      RAISE EXCEPTION 'primary registration is not editable (status=%)', v_primary.status
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.registrations
    SET
      user_id = p_user_id,
      salutation = nullif(trim(COALESCE(p_draft->>'salutation', '')), ''),
      first_name = v_first_name,
      last_name = v_last_name,
      suffix = nullif(trim(COALESCE(p_draft->>'suffix', '')), ''),
      email = v_email,
      mobile_phone = v_mobile,
      assistant_email = lower(nullif(trim(COALESCE(p_draft->>'assistant_email', '')), '')),
      street_address = v_street,
      address_line_2 = nullif(trim(COALESCE(p_draft->>'address_line_2', '')), ''),
      city = v_city,
      state = nullif(trim(COALESCE(p_draft->>'state', '')), ''),
      postal_code = v_postal,
      country_code = v_country,
      gender = nullif(trim(COALESCE(p_draft->>'gender', '')), ''),
      requires_interpretation = COALESCE((p_draft->>'requires_interpretation')::boolean, false),
      preferred_language = nullif(trim(COALESCE(p_draft->>'preferred_language', '')), ''),
      church_name = v_church,
      pastor_name = v_pastor,
      jurisdiction = v_jurisdiction,
      draft_last_step = v_draft_step,
      updated_by = p_user_id,
      row_version = row_version + 1
    WHERE id = v_primary.id
    RETURNING * INTO v_primary;

    PERFORM public._registration_audit(
      'registration.draft_updated',
      v_primary.id,
      p_user_id,
      v_email,
      jsonb_build_object(
        'group_id', v_group.id,
        'product_required', false,
        'draft_last_step', v_draft_step,
        'source', 'save_registration_primary_draft'
      )
    );
  ELSE
    INSERT INTO public.registrations (
      program_key,
      user_id,
      status,
      registration_group_id,
      is_primary_registrant,
      registration_product_id,
      salutation,
      first_name,
      last_name,
      suffix,
      email,
      mobile_phone,
      assistant_email,
      street_address,
      address_line_2,
      city,
      state,
      postal_code,
      country_code,
      gender,
      requires_interpretation,
      preferred_language,
      church_name,
      pastor_name,
      jurisdiction,
      amount_cents,
      currency,
      draft_last_step,
      created_by,
      updated_by,
      row_version
    ) VALUES (
      v_program_key,
      p_user_id,
      'draft',
      v_group.id,
      true,
      NULL,
      nullif(trim(COALESCE(p_draft->>'salutation', '')), ''),
      v_first_name,
      v_last_name,
      nullif(trim(COALESCE(p_draft->>'suffix', '')), ''),
      v_email,
      v_mobile,
      lower(nullif(trim(COALESCE(p_draft->>'assistant_email', '')), '')),
      v_street,
      nullif(trim(COALESCE(p_draft->>'address_line_2', '')), ''),
      v_city,
      nullif(trim(COALESCE(p_draft->>'state', '')), ''),
      v_postal,
      v_country,
      nullif(trim(COALESCE(p_draft->>'gender', '')), ''),
      COALESCE((p_draft->>'requires_interpretation')::boolean, false),
      nullif(trim(COALESCE(p_draft->>'preferred_language', '')), ''),
      v_church,
      v_pastor,
      v_jurisdiction,
      NULL,
      'usd',
      v_draft_step,
      p_user_id,
      p_user_id,
      1
    )
    RETURNING * INTO v_primary;

    v_created := true;

    PERFORM public._registration_audit(
      'registration.draft_created',
      v_primary.id,
      p_user_id,
      v_email,
      jsonb_build_object(
        'group_id', v_group.id,
        'product_required', false,
        'draft_last_step', v_draft_step,
        'source', 'save_registration_primary_draft'
      )
    );
  END IF;

  UPDATE public.registration_groups
  SET
    wizard_resume_step = GREATEST(wizard_resume_step, public._registration_step_to_resume(v_draft_step)),
    wizard_metadata = COALESCE(wizard_metadata, '{}'::jsonb) || jsonb_build_object(
      'last_primary_draft_saved_at', timezone('utc', now()),
      'primary_registration_id', v_primary.id,
      'draft_last_step', v_draft_step
    ),
    row_version = row_version + 1,
    updated_at = timezone('utc', now())
  WHERE id = v_group.id
  RETURNING * INTO v_group;

  RETURN jsonb_build_object(
    'ok', true,
    'created', v_created,
    'group_id', v_group.id,
    'group_version', v_group.row_version,
    'registration_id', v_primary.id,
    'registration_version', v_primary.row_version,
    'status', v_primary.status,
    'draft_last_step', v_primary.draft_last_step,
    'registration_product_id', v_primary.registration_product_id,
    'wizard_resume_step', v_group.wizard_resume_step
  );
END;
$$;

DROP FUNCTION IF EXISTS public.save_registration_primary_draft(uuid, jsonb);
REVOKE ALL ON FUNCTION public.save_registration_primary_draft(uuid, text, jsonb, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_registration_primary_draft(uuid, text, jsonb, integer, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_registration_primary_draft(uuid, text, jsonb, integer, integer) TO service_role;

-- ---------------------------------------------------------------------------
-- submit_registration_group
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.submit_registration_group(
  p_user_id uuid,
  p_group_id uuid,
  p_expected_group_version integer,
  p_expected_member_versions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.registration_groups%ROWTYPE;
  v_primary_id uuid;
  v_primary_email text;
  v_member_count integer := 0;
  v_updated_count integer := 0;
  v_total_cents integer := 0;
  v_currency text := 'usd';
  v_next_status text;
  v_now timestamptz := timezone('utc', now());
  v_policy_id uuid;
  v_policy_hash text;
  v_acceptance_hash text;
  v_member_ids uuid[] := ARRAY[]::uuid[];
  r RECORD;
BEGIN
  IF p_user_id IS NULL OR p_group_id IS NULL THEN
    RAISE EXCEPTION 'submit_registration_group requires authenticated user_id and group_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_group
  FROM public.registration_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration group not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_group.owner_user_id <> p_user_id THEN
    RAISE EXCEPTION 'registration group ownership mismatch'
      USING ERRCODE = '42501';
  END IF;

  PERFORM public._assert_registration_group_version(v_group, p_expected_group_version);

  IF v_group.status <> 'draft' THEN
    RAISE EXCEPTION 'registration group is not draft (status=%)', v_group.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT id, content_hash
  INTO v_policy_id, v_policy_hash
  FROM public.registration_policies
  WHERE program_key = v_group.program_key
    AND status = 'published'
  LIMIT 1;

  IF v_policy_id IS NULL THEN
    RAISE EXCEPTION 'a published registration policy is required before submission'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT policy_content_hash
  INTO v_acceptance_hash
  FROM public.registration_policy_acceptances
  WHERE registration_group_id = v_group.id
    AND policy_id = v_policy_id
  FOR UPDATE;

  IF v_acceptance_hash IS NULL OR v_acceptance_hash <> v_policy_hash THEN
    RAISE EXCEPTION 'accept the current registration policy before submitting'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1
  FROM public.registrations
  WHERE registration_group_id = v_group.id
  FOR UPDATE;

  PERFORM public._assert_registration_member_versions(v_group.id, p_expected_member_versions);

  SELECT COUNT(*)::integer
  INTO v_member_count
  FROM public.registrations
  WHERE registration_group_id = v_group.id;

  IF v_member_count < 1 THEN
    RAISE EXCEPTION 'complete the primary attendee registration first'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registrations
    WHERE registration_group_id = v_group.id
      AND status <> 'draft'
  ) THEN
    RAISE EXCEPTION 'registration group members are not all draft'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.registrations
    WHERE registration_group_id = v_group.id
      AND is_primary_registrant = true
  ) THEN
    RAISE EXCEPTION 'complete the primary attendee registration first'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registrations
    WHERE registration_group_id = v_group.id
      AND registration_product_id IS NULL
  ) THEN
    RAISE EXCEPTION 'every registrant must have one registration product'
      USING ERRCODE = 'check_violation';
  END IF;

  FOR r IN
    SELECT
      reg.id AS registration_id,
      prod.price_cents,
      prod.currency,
      prod.active,
      prod.public
    FROM public.registrations reg
    JOIN public.registration_products prod ON prod.id = reg.registration_product_id
    WHERE reg.registration_group_id = v_group.id
  LOOP
    IF NOT r.active OR NOT r.public THEN
      RAISE EXCEPTION 'one or more registration products are no longer available'
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.registrations
    SET
      amount_cents = r.price_cents,
      currency = COALESCE(NULLIF(trim(r.currency), ''), 'usd'),
      updated_by = p_user_id,
      row_version = row_version + 1
    WHERE id = r.registration_id
      AND status = 'draft';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> 1 THEN
      RAISE EXCEPTION 'failed to stamp amount for registration %', r.registration_id
        USING ERRCODE = 'check_violation';
    END IF;

    v_total_cents := v_total_cents + COALESCE(r.price_cents, 0);
    v_currency := COALESCE(NULLIF(trim(r.currency), ''), v_currency);
    v_member_ids := array_append(v_member_ids, r.registration_id);
  END LOOP;

  IF COALESCE(array_length(v_member_ids, 1), 0) <> v_member_count THEN
    RAISE EXCEPTION 'product pricing mismatch while submitting registration group'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.registrations
  SET
    status = 'submitted',
    submitted_at = COALESCE(submitted_at, v_now),
    updated_by = p_user_id,
    row_version = row_version + 1
  WHERE registration_group_id = v_group.id
    AND status = 'draft';

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_member_count THEN
    RAISE EXCEPTION 'registration changed while it was being submitted'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_total_cents = 0 THEN
    UPDATE public.registrations
    SET
      status = 'confirmed',
      confirmed_at = COALESCE(confirmed_at, v_now),
      updated_by = p_user_id,
      row_version = row_version + 1
    WHERE registration_group_id = v_group.id
      AND status = 'submitted';

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> v_member_count THEN
      RAISE EXCEPTION 'failed to confirm free registration group atomically'
        USING ERRCODE = 'check_violation';
    END IF;

    v_next_status := 'confirmed';
  ELSE
    v_next_status := 'submitted';
  END IF;

  SELECT id, email
  INTO v_primary_id, v_primary_email
  FROM public.registrations
  WHERE registration_group_id = v_group.id
    AND is_primary_registrant = true
  LIMIT 1;

  UPDATE public.registrations
  SET
    amount_cents = v_total_cents,
    currency = v_currency,
    updated_by = p_user_id,
    row_version = row_version + 1
  WHERE id = v_primary_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'failed to stamp primary group total'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.registration_groups
  SET
    status = v_next_status,
    wizard_resume_step = CASE WHEN v_next_status = 'confirmed' THEN 8 ELSE 7 END,
    wizard_metadata = COALESCE(wizard_metadata, '{}'::jsonb) || jsonb_build_object(
      'submitted_at', v_now,
      'total_cents', v_total_cents
    ),
    row_version = row_version + 1,
    updated_at = v_now
  WHERE id = v_group.id
    AND status = 'draft'
  RETURNING * INTO v_group;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'failed to transition registration group status'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public._registration_audit(
    'registration.submitted',
    v_primary_id,
    p_user_id,
    v_primary_email,
    jsonb_build_object(
      'group_id', v_group.id,
      'member_count', v_member_count,
      'total_cents', v_total_cents,
      'status', v_next_status,
      'source', 'submit_registration_group'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'registration_id', v_primary_id,
    'group_id', v_group.id,
    'status', v_next_status,
    'total_cents', v_total_cents,
    'currency', v_currency,
    'group_version', v_group.row_version,
    'transitioned_members', v_member_count,
    'member_ids', to_jsonb(v_member_ids),
    'member_count', v_member_count
  );
END;
$$;

DROP FUNCTION IF EXISTS public.submit_registration_group(uuid);
REVOKE ALL ON FUNCTION public.submit_registration_group(uuid, uuid, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_registration_group(uuid, uuid, integer, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.submit_registration_group(uuid, uuid, integer, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- confirm_paid_registration_group
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.confirm_paid_registration_group(
  p_registration_id uuid,
  p_actor_user_id uuid DEFAULT NULL,
  p_expected_group_version integer DEFAULT NULL,
  p_expected_member_versions jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_primary public.registrations%ROWTYPE;
  v_group public.registration_groups%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_member_ids uuid[] := ARRAY[]::uuid[];
  v_confirmed_ids uuid[] := ARRAY[]::uuid[];
  v_updated_count integer := 0;
  v_pending_count integer := 0;
BEGIN
  IF p_registration_id IS NULL THEN
    RAISE EXCEPTION 'confirm_paid_registration_group requires registration_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_primary
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration % not found', p_registration_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_primary.registration_group_id IS NULL THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'registration_id', v_primary.id,
      'group_id', NULL,
      'group_version', NULL,
      'member_ids', '[]'::jsonb,
      'status', v_primary.status,
      'transitioned_members', 0
    );
  END IF;

  SELECT *
  INTO v_group
  FROM public.registration_groups
  WHERE id = v_primary.registration_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration group % missing', v_primary.registration_group_id
      USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM public._assert_registration_group_version(v_group, p_expected_group_version);

  PERFORM 1
  FROM public.registrations
  WHERE registration_group_id = v_group.id
  FOR UPDATE;

  PERFORM public._assert_registration_member_versions(v_group.id, p_expected_member_versions);

  IF v_group.status = 'confirmed'
     AND NOT EXISTS (
       SELECT 1
       FROM public.registrations
       WHERE registration_group_id = v_group.id
         AND status <> 'confirmed'
         AND status NOT IN ('canceled', 'refunded')
     )
  THEN
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
    INTO v_member_ids
    FROM public.registrations
    WHERE registration_group_id = v_group.id
      AND status = 'confirmed';

    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'registration_id', v_primary.id,
      'group_id', v_group.id,
      'group_version', v_group.row_version,
      'member_ids', to_jsonb(v_member_ids),
      'status', 'confirmed',
      'transitioned_members', 0
    );
  END IF;

  IF v_primary.status <> 'confirmed' THEN
    RAISE EXCEPTION 'primary registration % must be confirmed before group sync (status=%)',
      v_primary.id, v_primary.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*)::integer
  INTO v_pending_count
  FROM public.registrations
  WHERE registration_group_id = v_group.id
    AND status IN ('submitted', 'payment_pending');

  IF v_pending_count > 0 THEN
    UPDATE public.registrations
    SET
      status = 'confirmed',
      confirmed_at = COALESCE(confirmed_at, v_now),
      updated_by = COALESCE(p_actor_user_id, updated_by),
      row_version = row_version + 1
    WHERE registration_group_id = v_group.id
      AND status IN ('submitted', 'payment_pending');

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> v_pending_count THEN
      RAISE EXCEPTION 'failed to confirm all pending group members atomically'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  UPDATE public.registration_groups
  SET
    status = 'confirmed',
    wizard_resume_step = 8,
    wizard_metadata = COALESCE(wizard_metadata, '{}'::jsonb) || jsonb_build_object(
      'confirmed_at', v_now,
      'source', 'confirm_paid_registration_group'
    ),
    row_version = row_version + 1,
    updated_at = v_now
  WHERE id = v_group.id
    AND status IN ('submitted', 'payment_pending', 'confirmed')
  RETURNING * INTO v_group;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'failed to confirm registration group %', v_group.id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(array_agg(id ORDER BY is_primary_registrant DESC, created_at ASC), ARRAY[]::uuid[])
  INTO v_confirmed_ids
  FROM public.registrations
  WHERE registration_group_id = v_group.id
    AND status = 'confirmed';

  PERFORM public._registration_audit(
    'registration.confirmed',
    v_primary.id,
    COALESCE(p_actor_user_id, v_primary.user_id),
    v_primary.email,
    jsonb_build_object(
      'group_id', v_group.id,
      'member_ids', to_jsonb(v_confirmed_ids),
      'source', 'confirm_paid_registration_group',
      'idempotent', false
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'registration_id', v_primary.id,
    'group_id', v_group.id,
    'group_version', v_group.row_version,
    'member_ids', to_jsonb(v_confirmed_ids),
    'status', 'confirmed',
    'transitioned_members', v_pending_count
  );
END;
$$;

DROP FUNCTION IF EXISTS public.confirm_paid_registration_group(uuid, uuid);
REVOKE ALL ON FUNCTION public.confirm_paid_registration_group(uuid, uuid, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_paid_registration_group(uuid, uuid, integer, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_paid_registration_group(uuid, uuid, integer, jsonb) TO service_role;

-- ---------------------------------------------------------------------------
-- cancel_registration_group
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_registration_group(
  p_group_id uuid,
  p_actor_user_id uuid,
  p_reason text,
  p_expected_group_version integer,
  p_expected_member_versions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group public.registration_groups%ROWTYPE;
  v_now timestamptz := timezone('utc', now());
  v_member_count integer := 0;
  v_updated_count integer := 0;
  v_member_ids uuid[] := ARRAY[]::uuid[];
  v_primary_id uuid;
  v_primary_email text;
BEGIN
  IF p_group_id IS NULL OR p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'cancel_registration_group requires group_id and actor_user_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_group
  FROM public.registration_groups
  WHERE id = p_group_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration group not found'
      USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM public._assert_registration_group_version(v_group, p_expected_group_version);

  IF v_group.status = 'canceled' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'group_id', v_group.id,
      'status', 'canceled',
      'group_version', v_group.row_version,
      'canceled_members', 0,
      'member_ids', '[]'::jsonb
    );
  END IF;

  IF v_group.status = 'confirmed' THEN
    RAISE EXCEPTION 'confirmed registration groups cannot be canceled via cancel_registration_group'
      USING ERRCODE = 'check_violation';
  END IF;

  PERFORM 1
  FROM public.registrations
  WHERE registration_group_id = v_group.id
  FOR UPDATE;

  PERFORM public._assert_registration_member_versions(v_group.id, p_expected_member_versions);

  IF EXISTS (
    SELECT 1
    FROM public.registrations
    WHERE registration_group_id = v_group.id
      AND status IN ('confirmed', 'refunded')
  ) THEN
    RAISE EXCEPTION 'group contains confirmed or refunded members and cannot be canceled atomically'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COUNT(*)::integer
  INTO v_member_count
  FROM public.registrations
  WHERE registration_group_id = v_group.id
    AND status IN ('draft', 'submitted', 'payment_pending');

  UPDATE public.registrations
  SET
    status = 'canceled',
    canceled_at = COALESCE(canceled_at, v_now),
    updated_by = p_actor_user_id,
    row_version = row_version + 1
  WHERE registration_group_id = v_group.id
    AND status IN ('draft', 'submitted', 'payment_pending');

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> v_member_count THEN
    RAISE EXCEPTION 'failed to cancel all group members atomically'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.registration_payments
  SET status = 'canceled'
  WHERE registration_id IN (
      SELECT id FROM public.registrations WHERE registration_group_id = v_group.id
    )
    AND status = 'pending';

  UPDATE public.registration_groups
  SET
    status = 'canceled',
    wizard_metadata = COALESCE(wizard_metadata, '{}'::jsonb) || jsonb_build_object(
      'canceled_at', v_now,
      'reason', NULLIF(trim(COALESCE(p_reason, '')), '')
    ),
    row_version = row_version + 1,
    updated_at = v_now
  WHERE id = v_group.id
    AND status IN ('draft', 'submitted', 'payment_pending')
  RETURNING * INTO v_group;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'failed to cancel registration group %', v_group.id
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT COALESCE(array_agg(id), ARRAY[]::uuid[])
  INTO v_member_ids
  FROM public.registrations
  WHERE registration_group_id = v_group.id
    AND status = 'canceled';

  SELECT id, email
  INTO v_primary_id, v_primary_email
  FROM public.registrations
  WHERE registration_group_id = v_group.id
    AND is_primary_registrant = true
  LIMIT 1;

  IF v_primary_id IS NOT NULL THEN
    PERFORM public._registration_audit(
      'registration.canceled',
      v_primary_id,
      p_actor_user_id,
      v_primary_email,
      jsonb_build_object(
        'group_id', v_group.id,
        'member_ids', to_jsonb(v_member_ids),
        'reason', NULLIF(trim(COALESCE(p_reason, '')), ''),
        'source', 'cancel_registration_group'
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'group_id', v_group.id,
    'registration_id', v_primary_id,
    'status', 'canceled',
    'group_version', v_group.row_version,
    'canceled_members', COALESCE(array_length(v_member_ids, 1), 0),
    'member_ids', to_jsonb(v_member_ids),
    'member_count', COALESCE(array_length(v_member_ids, 1), 0)
  );
END;
$$;

DROP FUNCTION IF EXISTS public.cancel_registration_group(uuid, uuid, text);
REVOKE ALL ON FUNCTION public.cancel_registration_group(uuid, uuid, text, integer, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_registration_group(uuid, uuid, text, integer, jsonb) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_registration_group(uuid, uuid, text, integer, jsonb) TO service_role;

COMMENT ON FUNCTION public.save_registration_primary_draft(uuid, text, jsonb, integer, integer) IS
  'Atomic primary draft upsert without product selection. Owner identity comes from p_user_id only.';
COMMENT ON FUNCTION public.submit_registration_group(uuid, uuid, integer, jsonb) IS
  'Atomic group submit with FOR UPDATE locks, version checks, DB product pricing, and audit.';
COMMENT ON FUNCTION public.confirm_paid_registration_group(uuid, uuid, integer, jsonb) IS
  'Atomic post-payment group confirm. Requires primary already confirmed by fulfill_registration_checkout.';
COMMENT ON FUNCTION public.cancel_registration_group(uuid, uuid, text, integer, jsonb) IS
  'Atomic cancel of draft/submitted/payment_pending group and members.';

-- ---------------------------------------------------------------------------
-- begin_registration_checkout
-- Stages pending payment + primary + group payment_pending atomically.
-- Amounts come from the locked registration row (never from the client).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.begin_registration_checkout(
  p_user_id uuid,
  p_stripe_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_group public.registration_groups%ROWTYPE;
  v_payment public.registration_payments%ROWTYPE;
  v_session text := nullif(trim(COALESCE(p_stripe_session_id, '')), '');
  v_updated_count integer := 0;
  v_has_group boolean := false;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'begin_registration_checkout requires authenticated user_id'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'begin_registration_checkout requires stripe_session_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE program_key = 'cogic-stream-2026'
    AND user_id = p_user_id
    AND is_primary_registrant = true
    AND status IN ('submitted', 'payment_pending')
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration not found for checkout'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_registration.amount_cents IS NULL OR v_registration.amount_cents <= 0 THEN
    RAISE EXCEPTION 'registration does not require payment'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_registration.registration_group_id IS NOT NULL THEN
    SELECT *
    INTO v_group
    FROM public.registration_groups
    WHERE id = v_registration.registration_group_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'registration group missing for checkout'
        USING ERRCODE = 'no_data_found';
    END IF;

    IF v_group.owner_user_id <> p_user_id THEN
      RAISE EXCEPTION 'registration group ownership mismatch'
        USING ERRCODE = '42501';
    END IF;

    v_has_group := true;
  END IF;

  INSERT INTO public.registration_payments (
    registration_id,
    status,
    amount_cents,
    currency,
    stripe_session_id,
    checkout_type
  ) VALUES (
    v_registration.id,
    'pending',
    v_registration.amount_cents,
    COALESCE(NULLIF(trim(v_registration.currency), ''), 'usd'),
    v_session,
    'registration'
  )
  RETURNING * INTO v_payment;

  UPDATE public.registrations
  SET
    status = 'payment_pending',
    updated_by = p_user_id,
    row_version = row_version + 1
  WHERE id = v_registration.id
    AND status IN ('submitted', 'payment_pending')
  RETURNING * INTO v_registration;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'failed to transition registration to payment_pending'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_has_group THEN
    UPDATE public.registration_groups
    SET
      status = 'payment_pending',
      wizard_resume_step = 7,
      wizard_metadata = COALESCE(wizard_metadata, '{}'::jsonb) || jsonb_build_object(
        'checkout_started_at', timezone('utc', now()),
        'stripe_session_id', v_session
      ),
      row_version = row_version + 1,
      updated_at = timezone('utc', now())
    WHERE id = v_group.id
      AND status IN ('submitted', 'payment_pending')
    RETURNING * INTO v_group;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> 1 THEN
      RAISE EXCEPTION 'failed to transition registration group to payment_pending'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  PERFORM public._registration_audit(
    'registration.checkout_started',
    v_registration.id,
    p_user_id,
    v_registration.email,
    jsonb_build_object(
      'stripe_session_id', v_session,
      'registration_payment_id', v_payment.id,
      'amount_cents', v_payment.amount_cents,
      'currency', v_payment.currency,
      'group_id', CASE WHEN v_has_group THEN v_group.id ELSE NULL END,
      'source', 'begin_registration_checkout'
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'registration_id', v_registration.id,
    'registration_status', v_registration.status,
    'registration_amount_cents', v_registration.amount_cents,
    'registration_currency', v_registration.currency,
    'registration_email', v_registration.email,
    'registration_row_version', v_registration.row_version,
    'payment_id', v_payment.id,
    'payment_status', v_payment.status,
    'payment_amount_cents', v_payment.amount_cents,
    'payment_currency', v_payment.currency,
    'stripe_session_id', v_payment.stripe_session_id,
    'group_id', CASE WHEN v_has_group THEN v_group.id ELSE NULL END,
    'group_version', CASE WHEN v_has_group THEN v_group.row_version ELSE NULL END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.begin_registration_checkout(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.begin_registration_checkout(uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.begin_registration_checkout(uuid, text) TO service_role;

-- ---------------------------------------------------------------------------
-- cancel_pending_registration_checkout
-- Cancels pending payment and rolls primary/group back to submitted atomically.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.cancel_pending_registration_checkout(
  p_user_id uuid,
  p_registration_id uuid,
  p_stripe_session_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_group public.registration_groups%ROWTYPE;
  v_payment public.registration_payments%ROWTYPE;
  v_session text := nullif(trim(COALESCE(p_stripe_session_id, '')), '');
  v_updated_count integer := 0;
BEGIN
  IF p_user_id IS NULL OR p_registration_id IS NULL THEN
    RAISE EXCEPTION 'cancel_pending_registration_checkout requires user_id and registration_id'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_session IS NULL THEN
    RAISE EXCEPTION 'cancel_pending_registration_checkout requires stripe_session_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = p_registration_id
    AND user_id = p_user_id
    AND program_key = 'cogic-stream-2026'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration not found for checkout cancel'
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.registration_payments
  WHERE registration_id = v_registration.id
    AND stripe_session_id = v_session
    AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'pending registration payment not found for stripe_session_id %', v_session
      USING ERRCODE = 'no_data_found';
  END IF;

  UPDATE public.registration_payments
  SET status = 'canceled'
  WHERE id = v_payment.id
    AND status = 'pending'
  RETURNING * INTO v_payment;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  IF v_updated_count <> 1 THEN
    RAISE EXCEPTION 'failed to cancel pending registration payment'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_registration.status = 'payment_pending' THEN
    UPDATE public.registrations
    SET
      status = 'submitted',
      updated_by = p_user_id,
      row_version = row_version + 1
    WHERE id = v_registration.id
      AND status = 'payment_pending'
    RETURNING * INTO v_registration;

    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    IF v_updated_count <> 1 THEN
      RAISE EXCEPTION 'failed to roll registration back to submitted'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF v_registration.registration_group_id IS NOT NULL THEN
    SELECT *
    INTO v_group
    FROM public.registration_groups
    WHERE id = v_registration.registration_group_id
    FOR UPDATE;

    IF FOUND AND v_group.status = 'payment_pending' THEN
      UPDATE public.registration_groups
      SET
        status = 'submitted',
        row_version = row_version + 1,
        updated_at = timezone('utc', now())
      WHERE id = v_group.id
        AND status = 'payment_pending'
      RETURNING * INTO v_group;

      GET DIAGNOSTICS v_updated_count = ROW_COUNT;
      IF v_updated_count <> 1 THEN
        RAISE EXCEPTION 'failed to roll registration group back to submitted'
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'registration_id', v_registration.id,
    'registration_status', v_registration.status,
    'payment_id', v_payment.id,
    'payment_status', v_payment.status,
    'group_id', v_group.id,
    'group_status', v_group.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_pending_registration_checkout(uuid, uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cancel_pending_registration_checkout(uuid, uuid, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pending_registration_checkout(uuid, uuid, text) TO service_role;

COMMENT ON FUNCTION public.begin_registration_checkout(uuid, text) IS
  'Atomic checkout begin: pending payment + primary/group payment_pending. Amounts from locked registration row.';
COMMENT ON FUNCTION public.cancel_pending_registration_checkout(uuid, uuid, text) IS
  'Atomic checkout cancel: pending payment canceled and statuses rolled back to submitted.';
