-- =============================================================================
-- Webhook idempotency hardening: short-circuit wallet credits on replay
-- =============================================================================

CREATE OR REPLACE FUNCTION public.fulfill_event_ticket_tier(
  p_stripe_session_id text,
  p_user_id uuid,
  p_email text,
  p_product_id text,
  p_amount_total integer,
  p_seed_bonus integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior_status text;
  v_seeds_credited integer := 0;
  v_seed_balance integer := 0;
BEGIN
  SELECT status
  INTO v_prior_status
  FROM public.orders
  WHERE stripe_session_id = p_stripe_session_id;

  IF COALESCE(v_prior_status, '') = 'paid' THEN
    IF p_user_id IS NOT NULL THEN
      SELECT balance
      INTO v_seed_balance
      FROM public.seed_wallets
      WHERE user_id = p_user_id;
    END IF;

    RETURN jsonb_build_object(
      'access_granted', true,
      'product_id', p_product_id,
      'seeds_credited', 0,
      'seed_balance', COALESCE(v_seed_balance, 0)
    );
  END IF;

  INSERT INTO public.orders (
    stripe_session_id,
    user_id,
    email,
    status,
    amount_total,
    product_type,
    created_at
  )
  VALUES (
    p_stripe_session_id,
    p_user_id,
    lower(trim(p_email)),
    'paid',
    p_amount_total,
    p_product_id,
    timezone('utc'::text, now())
  )
  ON CONFLICT (stripe_session_id)
  DO UPDATE SET
    status = 'paid',
    user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    amount_total = EXCLUDED.amount_total,
    product_type = EXCLUDED.product_type,
    created_at = timezone('utc'::text, now());

  IF p_seed_bonus > 0 AND p_user_id IS NOT NULL THEN
    v_seed_balance := public.credit_user_seeds(p_user_id, p_seed_bonus);
    v_seeds_credited := p_seed_bonus;
  ELSE
    IF p_user_id IS NOT NULL THEN
      SELECT balance
      INTO v_seed_balance
      FROM public.seed_wallets
      WHERE user_id = p_user_id;
    END IF;

    v_seed_balance := COALESCE(v_seed_balance, 0);
  END IF;

  RETURN jsonb_build_object(
    'access_granted', true,
    'product_id', p_product_id,
    'seeds_credited', v_seeds_credited,
    'seed_balance', v_seed_balance
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fulfill_stripe_checkout_session(
  p_stripe_session_id text,
  p_user_id uuid,
  p_email text,
  p_product_id text,
  p_amount_total integer,
  p_selected_size text DEFAULT 'N/A'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prior_status text;
  v_seed_credit integer;
BEGIN
  SELECT status
  INTO v_prior_status
  FROM public.orders
  WHERE stripe_session_id = p_stripe_session_id;

  IF COALESCE(v_prior_status, '') = 'paid' THEN
    RETURN;
  END IF;

  INSERT INTO public.orders (
    stripe_session_id,
    user_id,
    email,
    status,
    amount_total,
    product_type,
    created_at
  )
  VALUES (
    p_stripe_session_id,
    p_user_id,
    lower(trim(p_email)),
    'paid',
    p_amount_total,
    p_product_id,
    timezone('utc'::text, now())
  )
  ON CONFLICT (stripe_session_id)
  DO UPDATE SET
    status = 'paid',
    user_id = EXCLUDED.user_id,
    email = EXCLUDED.email,
    amount_total = EXCLUDED.amount_total,
    product_type = EXCLUDED.product_type,
    created_at = timezone('utc'::text, now());

  v_seed_credit := public.resolve_seed_pack_credit(p_product_id);

  IF v_seed_credit > 0 AND p_user_id IS NOT NULL THEN
    PERFORM public.credit_seed_wallet(p_user_id, v_seed_credit);
  END IF;
END;
$$;

COMMENT ON FUNCTION public.fulfill_event_ticket_tier IS
  'Marks ticket-tier orders paid and credits bundled seeds once per Stripe session.';

COMMENT ON FUNCTION public.fulfill_stripe_checkout_session IS
  'Marks merch/seed-pack orders paid and credits seeds once per Stripe session.';
