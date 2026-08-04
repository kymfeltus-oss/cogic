-- =============================================================================
-- Seed wallet ledger + live emote spend RPC + seed-pack fulfillment credits
-- =============================================================================

CREATE TABLE public.seed_wallets (
  user_id    uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  balance    integer     NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT seed_wallets_balance_non_negative CHECK (balance >= 0)
);

CREATE INDEX seed_wallets_updated_at_idx ON public.seed_wallets (updated_at DESC);

COMMENT ON TABLE public.seed_wallets IS
  'Per-user Vital Seed balance for live-room emote interactions.';
COMMENT ON COLUMN public.seed_wallets.balance IS
  'Spendable seed tokens (credited by seed-pack purchases).';

ALTER TABLE public.seed_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seed_wallets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS seed_wallets_select_own ON public.seed_wallets;
CREATE POLICY seed_wallets_select_own
  ON public.seed_wallets
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.seed_wallets FROM PUBLIC, anon;
GRANT SELECT ON public.seed_wallets TO authenticated;
GRANT ALL ON public.seed_wallets TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.seed_wallets;

-- Extend merch product ids for seed economy packs.
ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_product_type_check CHECK (
  product_type IN (
    'cd-preorder',
    'concert-tee',
    'choir-hoodie',
    'live-pass',
    'seed-pack-sower',
    'seed-pack-harvest',
    'seed-pack-golden',
    'ticket-tier-basic',
    'ticket-tier-pro',
    'ticket-tier-vip'
  )
);

CREATE OR REPLACE FUNCTION public.credit_seed_wallet(
  p_user_id uuid,
  p_amount integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'credit amount must be positive';
  END IF;

  INSERT INTO public.seed_wallets (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET
    balance = public.seed_wallets.balance + EXCLUDED.balance,
    updated_at = timezone('utc', now())
  RETURNING balance INTO v_balance;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.credit_seed_wallet(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.credit_seed_wallet(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.spend_seed_for_emote(
  p_user_id uuid,
  p_cost integer
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
BEGIN
  IF p_cost < 0 THEN
    RAISE EXCEPTION 'spend cost cannot be negative';
  END IF;

  IF p_cost = 0 THEN
    SELECT balance INTO v_balance
    FROM public.seed_wallets
    WHERE user_id = p_user_id;

    RETURN COALESCE(v_balance, 0);
  END IF;

  UPDATE public.seed_wallets
  SET
    balance = balance - p_cost,
    updated_at = timezone('utc', now())
  WHERE user_id = p_user_id
    AND balance >= p_cost
  RETURNING balance INTO v_balance;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'insufficient seed balance';
  END IF;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.spend_seed_for_emote(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.spend_seed_for_emote(uuid, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.resolve_seed_pack_credit(p_product_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_product_id
    WHEN 'seed-pack-sower' THEN 100
    WHEN 'seed-pack-harvest' THEN 350
    WHEN 'seed-pack-golden' THEN 800
    ELSE 0
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
  v_seed_credit integer;
BEGIN
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

REVOKE ALL ON FUNCTION public.fulfill_stripe_checkout_session(
  text, uuid, text, text, integer, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fulfill_stripe_checkout_session(
  text, uuid, text, text, integer, text
) TO service_role;
