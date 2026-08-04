-- =============================================================================
-- Server-authoritative emote billing: persist free-tap usage on seed_wallets
-- and atomically commit free taps + seed deductions via RPC.
-- =============================================================================

ALTER TABLE public.seed_wallets
  ADD COLUMN IF NOT EXISTS used_free_taps integer NOT NULL DEFAULT 0;

ALTER TABLE public.seed_wallets
  DROP CONSTRAINT IF EXISTS seed_wallets_used_free_taps_non_negative;

ALTER TABLE public.seed_wallets
  ADD CONSTRAINT seed_wallets_used_free_taps_non_negative
  CHECK (used_free_taps >= 0);

COMMENT ON COLUMN public.seed_wallets.used_free_taps IS
  'Lifetime free basic-emote taps consumed this concert session (server-enforced cap of 3).';

CREATE OR REPLACE FUNCTION public.process_emote_transaction(
  p_user_id uuid,
  p_free_taps_consumed integer,
  p_seed_cost integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_used_free_taps integer;
  v_free_limit constant integer := 3;
BEGIN
  IF p_free_taps_consumed < 0 OR p_seed_cost < 0 THEN
    RAISE EXCEPTION 'invalid emote transaction amounts';
  END IF;

  INSERT INTO public.seed_wallets (user_id, balance, used_free_taps)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT balance, used_free_taps
  INTO v_balance, v_used_free_taps
  FROM public.seed_wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seed wallet not found';
  END IF;

  IF v_used_free_taps + p_free_taps_consumed > v_free_limit THEN
    RAISE EXCEPTION 'free tap limit exceeded';
  END IF;

  IF p_seed_cost > 0 AND v_balance < p_seed_cost THEN
    RAISE EXCEPTION 'insufficient seed balance';
  END IF;

  UPDATE public.seed_wallets
  SET
    used_free_taps = used_free_taps + p_free_taps_consumed,
    balance = balance - p_seed_cost,
    updated_at = timezone('utc', now())
  WHERE user_id = p_user_id
  RETURNING balance, used_free_taps
  INTO v_balance, v_used_free_taps;

  RETURN jsonb_build_object(
    'balance', v_balance,
    'used_free_taps', v_used_free_taps
  );
END;
$$;

REVOKE ALL ON FUNCTION public.process_emote_transaction(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.process_emote_transaction(uuid, integer, integer) TO service_role;

CREATE OR REPLACE FUNCTION public.reverse_emote_transaction(
  p_user_id uuid,
  p_free_taps_consumed integer,
  p_seed_cost integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance integer;
  v_used_free_taps integer;
BEGIN
  IF p_free_taps_consumed < 0 OR p_seed_cost < 0 THEN
    RAISE EXCEPTION 'invalid emote reversal amounts';
  END IF;

  UPDATE public.seed_wallets
  SET
    used_free_taps = GREATEST(0, used_free_taps - p_free_taps_consumed),
    balance = balance + p_seed_cost,
    updated_at = timezone('utc', now())
  WHERE user_id = p_user_id
  RETURNING balance, used_free_taps
  INTO v_balance, v_used_free_taps;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'seed wallet not found';
  END IF;

  RETURN jsonb_build_object(
    'balance', v_balance,
    'used_free_taps', v_used_free_taps
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reverse_emote_transaction(uuid, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverse_emote_transaction(uuid, integer, integer) TO service_role;
