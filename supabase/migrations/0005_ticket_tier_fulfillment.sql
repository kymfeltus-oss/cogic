-- =============================================================================
-- Event ticket tier dual fulfillment: access grant + seed wallet injection
-- Non-destructive: adds RPC aliases/functions only.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.credit_user_seeds(
  p_user_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.credit_seed_wallet(p_user_id, p_amount);
$$;

REVOKE ALL ON FUNCTION public.credit_user_seeds(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_user_seeds(uuid, integer) TO service_role;

COMMENT ON FUNCTION public.credit_user_seeds(uuid, integer) IS
  'Alias for credit_seed_wallet — increments public.seed_wallets.balance for a user.';

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

  IF COALESCE(v_prior_status, '') <> 'paid'
     AND p_seed_bonus > 0
     AND p_user_id IS NOT NULL THEN
    v_seed_balance := public.credit_user_seeds(p_user_id, p_seed_bonus);
    v_seeds_credited := p_seed_bonus;
  ELSE
    SELECT balance
    INTO v_seed_balance
    FROM public.seed_wallets
    WHERE user_id = p_user_id;

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

REVOKE ALL ON FUNCTION public.fulfill_event_ticket_tier(
  text, uuid, text, text, integer, integer
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fulfill_event_ticket_tier(
  text, uuid, text, text, integer, integer
) TO service_role;

COMMENT ON FUNCTION public.fulfill_event_ticket_tier IS
  'Atomically marks ticket-tier orders paid and credits bundled seeds once per session.';
