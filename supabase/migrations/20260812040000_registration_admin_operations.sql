-- Registration Hub Phase 4: refund operations ledger + allowlisted attendee correction RPC.
-- SERVER AUTHORITY: profile corrections never accept price/status/payment fields from clients.
-- PAYMENTS: refund ledger records operator intent + Stripe refund identifiers; webhook/refund APIs remain authoritative for money movement.

CREATE TABLE IF NOT EXISTS public.registration_refund_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id uuid NOT NULL REFERENCES public.registrations (id) ON DELETE RESTRICT,
  payment_id uuid NULL REFERENCES public.registration_payments (id) ON DELETE SET NULL,
  group_id uuid NULL REFERENCES public.registration_groups (id) ON DELETE SET NULL,
  operation_key text NOT NULL,
  idempotency_key text NOT NULL,
  requested_amount_cents integer NOT NULL
    CHECK (requested_amount_cents > 0),
  currency text NOT NULL DEFAULT 'usd'
    CHECK (char_length(trim(currency)) > 0),
  stripe_refund_id text NULL,
  stripe_payment_intent_id text NULL,
  stripe_charge_id text NULL,
  status text NOT NULL DEFAULT 'requested'
    CHECK (status IN (
      'requested',
      'submitted_to_stripe',
      'succeeded',
      'failed',
      'canceled'
    )),
  operator_user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  operator_reason text NOT NULL
    CHECK (char_length(trim(operator_reason)) >= 8),
  failure_code text NULL,
  failure_message text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT registration_refund_operations_operation_key_unique UNIQUE (operation_key),
  CONSTRAINT registration_refund_operations_idempotency_key_unique UNIQUE (idempotency_key),
  CONSTRAINT registration_refund_operations_stripe_refund_id_unique UNIQUE (stripe_refund_id)
);

CREATE INDEX IF NOT EXISTS registration_refund_operations_registration_id_idx
  ON public.registration_refund_operations (registration_id);

CREATE INDEX IF NOT EXISTS registration_refund_operations_payment_id_idx
  ON public.registration_refund_operations (payment_id);

CREATE INDEX IF NOT EXISTS registration_refund_operations_status_idx
  ON public.registration_refund_operations (status);

CREATE INDEX IF NOT EXISTS registration_refund_operations_created_at_idx
  ON public.registration_refund_operations (created_at DESC);

DROP TRIGGER IF EXISTS registration_refund_operations_set_updated_at
  ON public.registration_refund_operations;
CREATE TRIGGER registration_refund_operations_set_updated_at
  BEFORE UPDATE ON public.registration_refund_operations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.registration_refund_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_refund_operations FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_refund_operations FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.registration_refund_operations TO service_role;

COMMENT ON TABLE public.registration_refund_operations IS
  'Operator refund ledger for registration payments. Tracks unique operation/idempotency keys, requested amounts, Stripe refund identifiers, and audit reasons. Does not invent refund success.';

COMMENT ON COLUMN public.registration_refund_operations.operation_key IS
  'Stable unique key for the refund operation (business identity).';

COMMENT ON COLUMN public.registration_refund_operations.idempotency_key IS
  'Stripe/API idempotency key; must be unique across all refund operations.';

COMMENT ON COLUMN public.registration_refund_operations.operator_reason IS
  'Required human-readable audit reason supplied by an authorized operator.';

-- ---------------------------------------------------------------------------
-- correct_registration_attendee
-- Allowlisted profile correction only. Blocks price/status/transaction fields.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.correct_registration_attendee(
  p_actor_user_id uuid,
  p_registration_id uuid,
  p_corrections jsonb,
  p_expected_registration_version integer DEFAULT NULL,
  p_audit_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_registration public.registrations%ROWTYPE;
  v_key text;
  v_allowed text[] := ARRAY[
    'firstName',
    'lastName',
    'email',
    'phone',
    'interpretationLanguage',
    'juniorDob'
  ];
  v_first_name text;
  v_last_name text;
  v_email text;
  v_phone text;
  v_interpretation_language text;
  v_junior_dob date;
  v_requires_interpretation boolean;
  v_reason text := NULLIF(trim(COALESCE(p_audit_reason, '')), '');
  v_previous_values jsonb;
  v_forbidden text[] := ARRAY[
    'amount_cents',
    'amountCents',
    'status',
    'user_id',
    'userId',
    'owner_user_id',
    'registration_product_id',
    'registrationProductId',
    'price_cents',
    'priceCents',
    'total_cents',
    'totalCents',
    'currency',
    'stripe_session_id',
    'stripeSessionId',
    'stripe_payment_intent_id',
    'stripePaymentIntentId',
    'confirmation_reference',
    'confirmationReference',
    'row_version',
    'rowVersion',
    'program_key',
    'programKey',
    'is_primary_registrant',
    'isPrimaryRegistrant',
    'registration_group_id',
    'registrationGroupId'
  ];
BEGIN
  IF p_actor_user_id IS NULL THEN
    RAISE EXCEPTION 'correct_registration_attendee requires actor user id'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_registration_id IS NULL THEN
    RAISE EXCEPTION 'correct_registration_attendee requires registration id'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_corrections IS NULL OR jsonb_typeof(p_corrections) <> 'object' THEN
    RAISE EXCEPTION 'correct_registration_attendee requires a JSON object corrections payload'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_reason IS NULL OR char_length(v_reason) < 8 THEN
    RAISE EXCEPTION 'correct_registration_attendee requires an audit reason of at least 8 characters'
      USING ERRCODE = 'check_violation';
  END IF;

  -- Reject any key outside the explicit allowlist (and all transactional authority keys).
  FOR v_key IN
    SELECT jsonb_object_keys(p_corrections)
  LOOP
    IF v_key = ANY (v_forbidden) THEN
      RAISE EXCEPTION 'correct_registration_attendee rejects transactional/authority field %', v_key
        USING ERRCODE = 'check_violation';
    END IF;

    IF NOT (v_key = ANY (v_allowed)) THEN
      RAISE EXCEPTION 'correct_registration_attendee rejects non-allowlisted field %', v_key
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;

  IF (
    SELECT count(*) FROM jsonb_object_keys(p_corrections) AS correction_keys(key)
  ) = 0 THEN
    RAISE EXCEPTION 'correct_registration_attendee requires at least one allowlisted correction'
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

  IF p_expected_registration_version IS NOT NULL
     AND v_registration.row_version IS DISTINCT FROM p_expected_registration_version THEN
    RAISE EXCEPTION 'registration version conflict (expected %, actual %)',
      p_expected_registration_version,
      v_registration.row_version
      USING ERRCODE = 'serialization_failure';
  END IF;

  IF v_registration.status IN ('canceled', 'refunded') THEN
    RAISE EXCEPTION 'cannot correct attendee profile for terminal status %', v_registration.status
      USING ERRCODE = 'check_violation';
  END IF;

  v_first_name := v_registration.first_name;
  v_last_name := v_registration.last_name;
  v_email := v_registration.email;
  v_phone := v_registration.mobile_phone;
  v_interpretation_language := v_registration.preferred_language;
  v_requires_interpretation := COALESCE(v_registration.requires_interpretation, false);
  v_junior_dob := v_registration.date_of_birth;
  v_previous_values := jsonb_build_object(
    'firstName', v_registration.first_name, 'lastName', v_registration.last_name,
    'email', v_registration.email, 'phone', v_registration.mobile_phone,
    'interpretationLanguage', v_registration.preferred_language,
    'juniorDob', v_registration.date_of_birth
  );

  IF p_corrections ? 'firstName' THEN
    v_first_name := NULLIF(trim(COALESCE(p_corrections->>'firstName', '')), '');
    IF v_first_name IS NULL THEN
      RAISE EXCEPTION 'firstName cannot be blank'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF p_corrections ? 'lastName' THEN
    v_last_name := NULLIF(trim(COALESCE(p_corrections->>'lastName', '')), '');
    IF v_last_name IS NULL THEN
      RAISE EXCEPTION 'lastName cannot be blank'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF p_corrections ? 'email' THEN
    v_email := lower(NULLIF(trim(COALESCE(p_corrections->>'email', '')), ''));
    IF v_email IS NULL OR v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
      RAISE EXCEPTION 'email correction is invalid'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF p_corrections ? 'phone' THEN
    v_phone := NULLIF(trim(COALESCE(p_corrections->>'phone', '')), '');
    IF v_phone IS NULL THEN
      RAISE EXCEPTION 'phone cannot be blank'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF p_corrections ? 'interpretationLanguage' THEN
    v_interpretation_language := NULLIF(trim(COALESCE(p_corrections->>'interpretationLanguage', '')), '');
    IF v_interpretation_language IS NULL THEN
      v_requires_interpretation := false;
    ELSE
      v_requires_interpretation := true;
    END IF;
  END IF;

  IF p_corrections ? 'juniorDob' THEN
    BEGIN
      v_junior_dob := NULLIF(trim(COALESCE(p_corrections->>'juniorDob', '')), '')::date;
    EXCEPTION
      WHEN others THEN
        RAISE EXCEPTION 'juniorDob must be a valid ISO date (YYYY-MM-DD)'
          USING ERRCODE = 'check_violation';
    END;
  END IF;

  UPDATE public.registrations
  SET
    first_name = v_first_name,
    last_name = v_last_name,
    email = v_email,
    mobile_phone = v_phone,
    preferred_language = v_interpretation_language,
    requires_interpretation = v_requires_interpretation,
    date_of_birth = v_junior_dob,
    row_version = COALESCE(v_registration.row_version, 1) + 1,
    updated_at = timezone('utc', now())
  WHERE id = v_registration.id
  RETURNING * INTO v_registration;

  PERFORM public._registration_audit(
    'registration.attendee_corrected',
    v_registration.id,
    p_actor_user_id,
    COALESCE(v_registration.email, ''),
    jsonb_build_object(
      'reason', v_reason,
      'corrected_keys', (
        SELECT coalesce(jsonb_agg(to_jsonb(correction_keys.key)), '[]'::jsonb)
        FROM jsonb_object_keys(p_corrections) AS correction_keys(key)
      ),
      'registration_group_id', v_registration.registration_group_id,
      'row_version', v_registration.row_version,
      'actor_user_id', p_actor_user_id,
      'corrected_at', timezone('utc', now()),
      'previous_values', v_previous_values,
      'new_values', jsonb_build_object(
        'firstName', v_registration.first_name, 'lastName', v_registration.last_name,
        'email', v_registration.email, 'phone', v_registration.mobile_phone,
        'interpretationLanguage', v_registration.preferred_language,
        'juniorDob', v_registration.date_of_birth
      )
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'registration_id', v_registration.id,
    'registration_group_id', v_registration.registration_group_id,
    'row_version', v_registration.row_version,
    'first_name', v_registration.first_name,
    'last_name', v_registration.last_name,
    'email', v_registration.email,
    'mobile_phone', v_registration.mobile_phone,
    'preferred_language', v_registration.preferred_language,
    'requires_interpretation', v_registration.requires_interpretation,
    'date_of_birth', v_registration.date_of_birth,
    'status', v_registration.status,
    'amount_cents', v_registration.amount_cents
  );
END;
$$;

REVOKE ALL ON FUNCTION public.correct_registration_attendee(uuid, uuid, jsonb, integer, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.correct_registration_attendee(uuid, uuid, jsonb, integer, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.correct_registration_attendee(uuid, uuid, jsonb, integer, text) TO service_role;

COMMENT ON FUNCTION public.correct_registration_attendee(uuid, uuid, jsonb, integer, text) IS
  'Allowlisted attendee profile correction under row lock. Rejects price/status/transaction fields. Service-role only.';
