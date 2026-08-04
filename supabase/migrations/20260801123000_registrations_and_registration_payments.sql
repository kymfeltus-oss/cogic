-- =============================================================================
-- 20260801123000_registrations_and_registration_payments.sql
-- COGIC STREAM — Registration data foundation (Phase 4B)
-- Target project: cogic (wjlaaluonxiaxmytiqwi)
-- Historical note: first applied on vital-organs-entertainment (tezzihhkqlovynybaypu)
-- Does not modify donations, orders, Stripe webhook routing, seeds, or merch.
-- Pricing not approved — amount_cents may be NULL; no free auto-confirm.
-- =============================================================================

-- Reuse canonical updated_at helper (created in events migration; safe IF exists).
CREATE OR REPLACE FUNCTION public.set_row_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- registrations
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registrations (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key     text        NOT NULL DEFAULT 'cogic-stream-2026',
  user_id         uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  status          text        NOT NULL DEFAULT 'draft',
  first_name      text        NULL,
  last_name       text        NULL,
  email           text        NULL,
  mobile_phone    text        NULL,
  street_address  text        NULL,
  city            text        NULL,
  state           text        NULL,
  postal_code     text        NULL,
  church_name     text        NULL,
  pastor_name     text        NULL,
  jurisdiction    text        NULL,
  amount_cents    integer     NULL,
  currency        text        NOT NULL DEFAULT 'usd',
  submitted_at    timestamptz NULL,
  confirmed_at    timestamptz NULL,
  canceled_at     timestamptz NULL,
  refunded_at     timestamptz NULL,
  created_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at      timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by      uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_by      uuid        NULL REFERENCES auth.users (id) ON DELETE SET NULL,

  CONSTRAINT registrations_program_key_not_blank CHECK (char_length(trim(program_key)) > 0),
  CONSTRAINT registrations_currency_not_blank CHECK (char_length(trim(currency)) > 0),
  CONSTRAINT registrations_status_check CHECK (
    status IN (
      'draft',
      'submitted',
      'payment_pending',
      'confirmed',
      'canceled',
      'refunded'
    )
  ),
  CONSTRAINT registrations_amount_cents_non_negative CHECK (
    amount_cents IS NULL OR amount_cents >= 0
  )
);

COMMENT ON TABLE public.registrations IS
  'Convocation registration applications. Field values are historical snapshots.';
COMMENT ON COLUMN public.registrations.program_key IS
  'Program/season scope key. 2026 Convocation uses cogic-stream-2026.';
COMMENT ON COLUMN public.registrations.amount_cents IS
  'Registration fee in cents when priced. NULL until pricing is approved.';

CREATE INDEX IF NOT EXISTS registrations_program_key_status_idx
  ON public.registrations (program_key, status);
CREATE INDEX IF NOT EXISTS registrations_user_id_idx
  ON public.registrations (user_id)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS registrations_email_idx
  ON public.registrations (lower(email))
  WHERE email IS NOT NULL;

-- Active = draft | submitted | payment_pending | confirmed
CREATE UNIQUE INDEX IF NOT EXISTS registrations_active_user_uidx
  ON public.registrations (program_key, user_id)
  WHERE user_id IS NOT NULL
    AND status IN ('draft', 'submitted', 'payment_pending', 'confirmed');

CREATE UNIQUE INDEX IF NOT EXISTS registrations_active_email_uidx
  ON public.registrations (program_key, (lower(email)))
  WHERE email IS NOT NULL
    AND status IN ('draft', 'submitted', 'payment_pending', 'confirmed');

DROP TRIGGER IF EXISTS registrations_set_updated_at ON public.registrations;
CREATE TRIGGER registrations_set_updated_at
  BEFORE UPDATE ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- Normalize email/phone whitespace on write
CREATE OR REPLACE FUNCTION public.normalize_registration_row()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.program_key := trim(NEW.program_key);
  NEW.currency := lower(trim(NEW.currency));

  IF NEW.email IS NOT NULL THEN
    NEW.email := lower(trim(NEW.email));
    IF NEW.email = '' THEN
      NEW.email := NULL;
    END IF;
  END IF;

  IF NEW.first_name IS NOT NULL THEN
    NEW.first_name := trim(NEW.first_name);
    IF NEW.first_name = '' THEN NEW.first_name := NULL; END IF;
  END IF;
  IF NEW.last_name IS NOT NULL THEN
    NEW.last_name := trim(NEW.last_name);
    IF NEW.last_name = '' THEN NEW.last_name := NULL; END IF;
  END IF;
  IF NEW.mobile_phone IS NOT NULL THEN
    NEW.mobile_phone := trim(NEW.mobile_phone);
    IF NEW.mobile_phone = '' THEN NEW.mobile_phone := NULL; END IF;
  END IF;
  IF NEW.street_address IS NOT NULL THEN
    NEW.street_address := trim(NEW.street_address);
    IF NEW.street_address = '' THEN NEW.street_address := NULL; END IF;
  END IF;
  IF NEW.city IS NOT NULL THEN
    NEW.city := trim(NEW.city);
    IF NEW.city = '' THEN NEW.city := NULL; END IF;
  END IF;
  IF NEW.state IS NOT NULL THEN
    NEW.state := upper(trim(NEW.state));
    IF NEW.state = '' THEN NEW.state := NULL; END IF;
  END IF;
  IF NEW.postal_code IS NOT NULL THEN
    NEW.postal_code := trim(NEW.postal_code);
    IF NEW.postal_code = '' THEN NEW.postal_code := NULL; END IF;
  END IF;
  IF NEW.church_name IS NOT NULL THEN
    NEW.church_name := trim(NEW.church_name);
    IF NEW.church_name = '' THEN NEW.church_name := NULL; END IF;
  END IF;
  IF NEW.pastor_name IS NOT NULL THEN
    NEW.pastor_name := trim(NEW.pastor_name);
    IF NEW.pastor_name = '' THEN NEW.pastor_name := NULL; END IF;
  END IF;
  IF NEW.jurisdiction IS NOT NULL THEN
    NEW.jurisdiction := trim(NEW.jurisdiction);
    IF NEW.jurisdiction = '' THEN NEW.jurisdiction := NULL; END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_normalize_row ON public.registrations;
CREATE TRIGGER registrations_normalize_row
  BEFORE INSERT OR UPDATE ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.normalize_registration_row();

-- Submission completeness when leaving draft into application statuses
CREATE OR REPLACE FUNCTION public.validate_registration_submission_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'payment_pending', 'confirmed') THEN
    IF NEW.first_name IS NULL
       OR NEW.last_name IS NULL
       OR NEW.email IS NULL
       OR NEW.email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
       OR NEW.mobile_phone IS NULL
       OR NEW.street_address IS NULL
       OR NEW.city IS NULL
       OR NEW.state IS NULL
       OR NEW.postal_code IS NULL
       OR NEW.church_name IS NULL
       OR NEW.pastor_name IS NULL
       OR NEW.jurisdiction IS NULL
    THEN
      RAISE EXCEPTION
        'registration status % requires complete contact, address, and church fields',
        NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_validate_submission ON public.registrations;
CREATE TRIGGER registrations_validate_submission
  BEFORE INSERT OR UPDATE ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_registration_submission_fields();

-- Lifecycle transitions (UPDATE only; INSERT must start as draft)
CREATE OR REPLACE FUNCTION public.validate_registration_status_transition()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  allowed boolean := false;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'draft' THEN
      RAISE EXCEPTION
        'registrations may only be inserted with status draft (got %)',
        NEW.status
        USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  allowed := CASE
    WHEN OLD.status = 'draft' AND NEW.status IN ('submitted', 'canceled') THEN true
    WHEN OLD.status = 'submitted'
      AND NEW.status IN ('payment_pending', 'confirmed', 'canceled') THEN true
    WHEN OLD.status = 'payment_pending'
      AND NEW.status IN ('confirmed', 'submitted', 'canceled') THEN true
    WHEN OLD.status = 'confirmed' AND NEW.status = 'refunded' THEN true
    ELSE false
  END;

  IF NOT allowed THEN
    RAISE EXCEPTION
      'invalid registration status transition: % → %',
      OLD.status, NEW.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.status = 'submitted' AND OLD.status = 'draft' THEN
    NEW.submitted_at := COALESCE(NEW.submitted_at, timezone('utc', now()));
  END IF;

  IF NEW.status = 'confirmed' THEN
    NEW.confirmed_at := COALESCE(NEW.confirmed_at, timezone('utc', now()));
  END IF;

  IF NEW.status = 'canceled' THEN
    NEW.canceled_at := COALESCE(NEW.canceled_at, timezone('utc', now()));
  END IF;

  IF NEW.status = 'refunded' THEN
    NEW.refunded_at := COALESCE(NEW.refunded_at, timezone('utc', now()));
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS registrations_validate_status_transition ON public.registrations;
CREATE TRIGGER registrations_validate_status_transition
  BEFORE INSERT OR UPDATE OF status ON public.registrations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_registration_status_transition();

-- ---------------------------------------------------------------------------
-- registration_payments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.registration_payments (
  id                        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id           uuid        NOT NULL REFERENCES public.registrations (id) ON DELETE RESTRICT,
  status                    text        NOT NULL DEFAULT 'pending',
  amount_cents              integer     NOT NULL,
  currency                  text        NOT NULL DEFAULT 'usd',
  stripe_session_id         text        NULL,
  stripe_payment_intent_id  text        NULL,
  checkout_type             text        NOT NULL DEFAULT 'registration',
  created_at                timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at                timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT registration_payments_amount_cents_non_negative CHECK (amount_cents >= 0),
  CONSTRAINT registration_payments_currency_not_blank CHECK (char_length(trim(currency)) > 0),
  CONSTRAINT registration_payments_status_check CHECK (
    status IN ('pending', 'paid', 'failed', 'canceled', 'refunded')
  ),
  CONSTRAINT registration_payments_checkout_type_check CHECK (
    checkout_type = 'registration'
  ),
  CONSTRAINT registration_payments_stripe_session_id_unique UNIQUE (stripe_session_id)
);

COMMENT ON TABLE public.registration_payments IS
  'Stripe payment ledger for Convocation registration. Distinct from donations and orders.';
COMMENT ON COLUMN public.registration_payments.checkout_type IS
  'Must always be registration — never donations/orders/seeds/tickets.';

CREATE INDEX IF NOT EXISTS registration_payments_registration_id_idx
  ON public.registration_payments (registration_id);
CREATE INDEX IF NOT EXISTS registration_payments_status_idx
  ON public.registration_payments (status);

DROP TRIGGER IF EXISTS registration_payments_set_updated_at ON public.registration_payments;
CREATE TRIGGER registration_payments_set_updated_at
  BEFORE UPDATE ON public.registration_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registrations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registration_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_payments FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.registrations FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.registration_payments FROM PUBLIC, anon, authenticated;

GRANT SELECT ON public.registrations TO authenticated;
GRANT SELECT ON public.registration_payments TO authenticated;
GRANT ALL ON public.registrations TO service_role;
GRANT ALL ON public.registration_payments TO service_role;

DROP POLICY IF EXISTS registrations_select_own ON public.registrations;
CREATE POLICY registrations_select_own
  ON public.registrations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS registration_payments_select_own ON public.registration_payments;
CREATE POLICY registration_payments_select_own
  ON public.registration_payments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.registrations r
      WHERE r.id = registration_payments.registration_id
        AND r.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- fulfill_registration_checkout (service_role / future webhook only)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_registration_checkout(
  p_stripe_session_id text,
  p_stripe_payment_intent_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment public.registration_payments%ROWTYPE;
  v_registration public.registrations%ROWTYPE;
BEGIN
  IF p_stripe_session_id IS NULL OR char_length(trim(p_stripe_session_id)) = 0 THEN
    RAISE EXCEPTION 'fulfill_registration_checkout requires stripe_session_id'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT *
  INTO v_payment
  FROM public.registration_payments
  WHERE stripe_session_id = trim(p_stripe_session_id)
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'registration payment not found for stripe_session_id %',
      p_stripe_session_id
      USING ERRCODE = 'no_data_found';
  END IF;

  SELECT *
  INTO v_registration
  FROM public.registrations
  WHERE id = v_payment.registration_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'registration missing for payment %',
      v_payment.id
      USING ERRCODE = 'no_data_found';
  END IF;

  -- Idempotent success path (no second audit / no second confirmation)
  IF v_payment.status = 'paid'
     AND v_registration.status = 'confirmed'
  THEN
    RETURN jsonb_build_object(
      'ok', true,
      'idempotent', true,
      'registration_id', v_registration.id,
      'registration_payment_id', v_payment.id,
      'status', v_registration.status
    );
  END IF;

  IF v_payment.status <> 'pending' THEN
    RAISE EXCEPTION
      'registration payment % is not pending (status=%)',
      v_payment.id, v_payment.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_registration.status <> 'payment_pending' THEN
    RAISE EXCEPTION
      'registration % is not payment_pending (status=%)',
      v_registration.id, v_registration.status
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_payment.checkout_type <> 'registration' THEN
    RAISE EXCEPTION
      'registration payment checkout_type must be registration'
      USING ERRCODE = 'check_violation';
  END IF;

  UPDATE public.registration_payments
  SET
    status = 'paid',
    stripe_payment_intent_id = COALESCE(
      NULLIF(trim(COALESCE(p_stripe_payment_intent_id, '')), ''),
      stripe_payment_intent_id
    )
  WHERE id = v_payment.id;

  UPDATE public.registrations
  SET
    status = 'confirmed',
    confirmed_at = COALESCE(confirmed_at, timezone('utc', now()))
  WHERE id = v_registration.id;

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
    v_registration.user_id,
    v_registration.email,
    'registration.confirmed',
    'registration',
    v_registration.id::text,
    jsonb_build_object(
      'idempotent', false,
      'stripe_session_id', p_stripe_session_id,
      'stripe_payment_intent_id', p_stripe_payment_intent_id,
      'registration_payment_id', v_payment.id::text,
      'program_key', v_registration.program_key,
      'amount_cents', v_payment.amount_cents
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'idempotent', false,
    'registration_id', v_registration.id,
    'registration_payment_id', v_payment.id,
    'status', 'confirmed'
  );
END;
$$;

COMMENT ON FUNCTION public.fulfill_registration_checkout(text, text) IS
  'Idempotent registration payment fulfillment for future Stripe webhook/service_role use. Does not trust client amounts.';

REVOKE ALL ON FUNCTION public.fulfill_registration_checkout(text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_registration_checkout(text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fulfill_registration_checkout(text, text) TO service_role;
