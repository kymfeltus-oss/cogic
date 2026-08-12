-- Registration Hub Phase 3: claim/complete refund ledger RPCs.
-- Amounts always come from locked registration_payments rows — never from clients.

CREATE OR REPLACE FUNCTION public.claim_registration_refund_operation(
  p_actor_user_id uuid,
  p_registration_id uuid,
  p_operation_key text,
  p_idempotency_key text,
  p_operator_reason text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_payment public.registration_payments%ROWTYPE;
  v_existing public.registration_refund_operations%ROWTYPE;
  v_operation public.registration_refund_operations%ROWTYPE;
  v_reason text := NULLIF(trim(COALESCE(p_operator_reason, '')), '');
  v_operation_key text := NULLIF(trim(COALESCE(p_operation_key, '')), '');
  v_idempotency_key text := NULLIF(trim(COALESCE(p_idempotency_key, '')), '');
BEGIN
  IF p_actor_user_id IS NULL OR p_registration_id IS NULL THEN
    RAISE EXCEPTION 'claim_registration_refund_operation requires actor and registration'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_operation_key IS NULL OR v_idempotency_key IS NULL THEN
    RAISE EXCEPTION 'claim_registration_refund_operation requires operation and idempotency keys'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 8 THEN
    RAISE EXCEPTION 'claim_registration_refund_operation requires an operator reason of at least 8 characters'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_existing
  FROM public.registration_refund_operations
  WHERE operation_key = v_operation_key
     OR idempotency_key = v_idempotency_key
  LIMIT 1;

  IF FOUND THEN
    IF v_existing.status IN ('requested', 'submitted_to_stripe', 'succeeded') THEN
      RETURN jsonb_build_object(
        'ok', true,
        'idempotent', true,
        'operation_id', v_existing.id,
        'registration_id', v_existing.registration_id,
        'payment_id', v_existing.payment_id,
        'group_id', v_existing.group_id,
        'status', v_existing.status,
        'requested_amount_cents', v_existing.requested_amount_cents,
        'currency', v_existing.currency,
        'stripe_payment_intent_id', v_existing.stripe_payment_intent_id,
        'stripe_refund_id', v_existing.stripe_refund_id
      );
    END IF;
    RAISE EXCEPTION 'refund operation % is not claimable (status=%)', v_existing.id, v_existing.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = p_registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registration % not found', p_registration_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_registration.status = 'refunded' THEN
    RAISE EXCEPTION 'registration % is already refunded', p_registration_id
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_registration.status <> 'confirmed' THEN
    RAISE EXCEPTION 'registration refund requires confirmed status (status=%)', v_registration.status
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.registration_payments
  WHERE registration_id = v_registration.id
    AND status = 'paid'
  ORDER BY created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'no paid registration payment found for refund'
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_payment.amount_cents IS NULL OR v_payment.amount_cents <= 0 THEN
    RAISE EXCEPTION 'paid registration payment has no refundable amount'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NULLIF(trim(COALESCE(v_payment.stripe_payment_intent_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'paid registration payment is missing stripe_payment_intent_id'
      USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.registration_refund_operations
    WHERE payment_id = v_payment.id
      AND status IN ('requested', 'submitted_to_stripe', 'succeeded')
  ) THEN
    RAISE EXCEPTION 'an open or succeeded refund already exists for payment %', v_payment.id
      USING ERRCODE = 'unique_violation';
  END IF;

  INSERT INTO public.registration_refund_operations (
    registration_id,
    payment_id,
    group_id,
    operation_key,
    idempotency_key,
    requested_amount_cents,
    currency,
    stripe_payment_intent_id,
    status,
    operator_user_id,
    operator_reason,
    metadata
  ) VALUES (
    v_registration.id,
    v_payment.id,
    v_registration.registration_group_id,
    v_operation_key,
    v_idempotency_key,
    v_payment.amount_cents,
    COALESCE(NULLIF(trim(v_payment.currency), ''), 'usd'),
    v_payment.stripe_payment_intent_id,
    'submitted_to_stripe',
    p_actor_user_id,
    v_reason,
    jsonb_build_object(
      'source', 'owner_admin_refund',
      'registration_status', v_registration.status
    )
  )
  RETURNING * INTO v_operation;

  PERFORM public._registration_audit(
    'registration.refund_claimed',
    v_registration.id,
    p_actor_user_id,
    COALESCE(v_registration.email, ''),
    jsonb_build_object(
      'operation_id', v_operation.id,
      'payment_id', v_payment.id,
      'requested_amount_cents', v_operation.requested_amount_cents,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'operation_id', v_operation.id,
    'registration_id', v_registration.id,
    'payment_id', v_payment.id,
    'group_id', v_registration.registration_group_id,
    'status', v_operation.status,
    'requested_amount_cents', v_operation.requested_amount_cents,
    'currency', v_operation.currency,
    'stripe_payment_intent_id', v_operation.stripe_payment_intent_id,
    'stripe_refund_id', v_operation.stripe_refund_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.claim_registration_refund_operation(uuid, uuid, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_registration_refund_operation(uuid, uuid, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_registration_refund_operation(uuid, uuid, text, text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.complete_registration_refund_operation(
  p_actor_user_id uuid,
  p_operation_id uuid,
  p_outcome text,
  p_stripe_refund_id text DEFAULT NULL,
  p_failure_code text DEFAULT NULL,
  p_failure_message text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_operation public.registration_refund_operations%ROWTYPE;
  v_registration public.registrations%ROWTYPE;
  v_outcome text := lower(NULLIF(trim(COALESCE(p_outcome, '')), ''));
  v_now timestamptz := timezone('utc', now());
  v_refund_id text := NULLIF(trim(COALESCE(p_stripe_refund_id, '')), '');
BEGIN
  IF p_actor_user_id IS NULL OR p_operation_id IS NULL THEN
    RAISE EXCEPTION 'complete_registration_refund_operation requires actor and operation'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_outcome NOT IN ('succeeded', 'failed', 'canceled') THEN
    RAISE EXCEPTION 'complete_registration_refund_operation outcome must be succeeded, failed, or canceled'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_operation
  FROM public.registration_refund_operations
  WHERE id = p_operation_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'refund operation % not found', p_operation_id
      USING ERRCODE = 'no_data_found';
  END IF;

  IF v_operation.status = 'succeeded' AND v_outcome = 'succeeded' THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'operation_id', v_operation.id,
      'status', v_operation.status,
      'registration_id', v_operation.registration_id,
      'stripe_refund_id', v_operation.stripe_refund_id
    );
  END IF;

  IF v_outcome = 'succeeded' THEN
    IF v_refund_id IS NULL THEN
      RAISE EXCEPTION 'succeeded refund completion requires stripe_refund_id'
        USING ERRCODE = 'check_violation';
    END IF;

    UPDATE public.registration_refund_operations
    SET
      status = 'succeeded',
      stripe_refund_id = v_refund_id,
      failure_code = NULL,
      failure_message = NULL,
      updated_at = v_now
    WHERE id = v_operation.id
    RETURNING * INTO v_operation;

    UPDATE public.registration_payments
    SET
      status = 'refunded',
      updated_at = v_now
    WHERE id = v_operation.payment_id
      AND status = 'paid';

    UPDATE public.registrations
    SET
      status = 'refunded',
      refunded_at = COALESCE(refunded_at, v_now),
      updated_by = p_actor_user_id,
      row_version = COALESCE(row_version, 1) + 1,
      updated_at = v_now
    WHERE id = v_operation.registration_id
      AND status = 'confirmed'
    RETURNING * INTO v_registration;

    IF v_operation.group_id IS NOT NULL THEN
      -- Preserve group status as source-of-truth for lifecycle history; member status is refunded.
      UPDATE public.registration_groups
      SET
        wizard_metadata = COALESCE(wizard_metadata, '{}'::jsonb) || jsonb_build_object(
          'refunded_at', v_now,
          'refund_operation_id', v_operation.id,
          'refund_registration_id', v_operation.registration_id
        ),
        row_version = row_version + 1,
        updated_at = v_now
      WHERE id = v_operation.group_id;
    END IF;

    PERFORM public._registration_audit(
      'registration.refund_succeeded',
      v_operation.registration_id,
      p_actor_user_id,
      COALESCE(v_registration.email, ''),
      jsonb_build_object(
        'operation_id', v_operation.id,
        'stripe_refund_id', v_refund_id,
        'requested_amount_cents', v_operation.requested_amount_cents
      )
    );
  ELSE
    UPDATE public.registration_refund_operations
    SET
      status = v_outcome,
      failure_code = NULLIF(trim(COALESCE(p_failure_code, '')), ''),
      failure_message = NULLIF(trim(COALESCE(p_failure_message, '')), ''),
      updated_at = v_now
    WHERE id = v_operation.id
    RETURNING * INTO v_operation;

    PERFORM public._registration_audit(
      'registration.refund_failed',
      v_operation.registration_id,
      p_actor_user_id,
      '',
      jsonb_build_object(
        'operation_id', v_operation.id,
        'outcome', v_outcome,
        'failure_code', v_operation.failure_code,
        'failure_message', v_operation.failure_message
      )
    );
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'operation_id', v_operation.id,
    'status', v_operation.status,
    'registration_id', v_operation.registration_id,
    'stripe_refund_id', v_operation.stripe_refund_id,
    'requested_amount_cents', v_operation.requested_amount_cents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.complete_registration_refund_operation(uuid, uuid, text, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.complete_registration_refund_operation(uuid, uuid, text, text, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.complete_registration_refund_operation(uuid, uuid, text, text, text, text) TO service_role;

COMMENT ON FUNCTION public.claim_registration_refund_operation(uuid, uuid, text, text, text) IS
  'Claims a registration refund ledger row using the locked paid payment amount. Never accepts client amounts.';
COMMENT ON FUNCTION public.complete_registration_refund_operation(uuid, uuid, text, text, text, text) IS
  'Completes a claimed registration refund operation and updates payment/registration ledger rows.';
