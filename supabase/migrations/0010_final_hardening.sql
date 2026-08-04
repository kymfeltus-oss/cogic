-- =============================================================================
-- 0010_final_hardening.sql
-- Table restoration, RLS/donations, SECURITY INVOKER view, RPC hardening,
-- emote billing signature sync, playback URL isolation at DB layer.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. seed_wallets (restore if missing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seed_wallets (
  user_id        uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  balance        integer     NOT NULL DEFAULT 0,
  used_free_taps integer     NOT NULL DEFAULT 0,
  updated_at     timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT seed_wallets_balance_non_negative CHECK (balance >= 0),
  CONSTRAINT seed_wallets_used_free_taps_non_negative CHECK (used_free_taps >= 0)
);

CREATE INDEX IF NOT EXISTS seed_wallets_updated_at_idx
  ON public.seed_wallets (updated_at DESC);

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

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.seed_wallets;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 2. live_acknowledgments (restore if missing)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.live_acknowledgments (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id     uuid        REFERENCES public.orders (id) ON DELETE SET NULL,
  display_name text        NOT NULL,
  product_type text        NOT NULL,
  amount_total integer     NOT NULL,
  message      text        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT live_acknowledgments_display_name_not_blank
    CHECK (char_length(trim(display_name)) > 0),
  CONSTRAINT live_acknowledgments_message_not_blank
    CHECK (char_length(trim(message)) > 0),
  CONSTRAINT live_acknowledgments_amount_total_positive
    CHECK (amount_total > 0)
);

CREATE INDEX IF NOT EXISTS live_acknowledgments_created_at_idx
  ON public.live_acknowledgments (created_at DESC);

ALTER TABLE public.live_acknowledgments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_acknowledgments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS live_acknowledgments_select_authenticated ON public.live_acknowledgments;
CREATE POLICY live_acknowledgments_select_authenticated
  ON public.live_acknowledgments
  FOR SELECT
  TO authenticated
  USING (true);

REVOKE ALL ON public.live_acknowledgments FROM PUBLIC, anon;
GRANT SELECT ON public.live_acknowledgments TO authenticated;
GRANT ALL ON public.live_acknowledgments TO service_role;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.live_acknowledgments;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- 3. donations RLS (restore policies if drifted)
-- ---------------------------------------------------------------------------
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS donations_select_own ON public.donations;
CREATE POLICY donations_select_own
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

REVOKE ALL ON public.donations FROM PUBLIC, anon;
GRANT SELECT ON public.donations TO authenticated;
GRANT ALL ON public.donations TO service_role;

-- ---------------------------------------------------------------------------
-- 4. live_donation_totals — SECURITY INVOKER view
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.live_donation_totals;

CREATE VIEW public.live_donation_totals
WITH (security_invoker = true)
AS
SELECT
  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0)::bigint AS total_cents,
  COUNT(*) FILTER (WHERE status = 'paid')::bigint AS donation_count
FROM public.donations;

GRANT SELECT ON public.live_donation_totals TO authenticated;
GRANT SELECT ON public.live_donation_totals TO service_role;

-- ---------------------------------------------------------------------------
-- 5. live_stream_state — hide playback_url from direct client SELECT
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS live_stream_state_select_authenticated ON public.live_stream_state;
REVOKE SELECT ON public.live_stream_state FROM authenticated;

DROP VIEW IF EXISTS public.live_stream_status_public;
CREATE VIEW public.live_stream_status_public
WITH (security_invoker = true)
AS
SELECT id, is_live, updated_at
FROM public.live_stream_state;

GRANT SELECT ON public.live_stream_status_public TO authenticated;

-- ---------------------------------------------------------------------------
-- 6. RPC signature sync — emote billing (matches app/api/live/emote/route.ts)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.process_emote_transaction(uuid, integer, integer);
DROP FUNCTION IF EXISTS public.reverse_emote_transaction(uuid, integer, integer);

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

-- ---------------------------------------------------------------------------
-- 7. Fulfillment gate — revoke public/anon/authenticated EXECUTE
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure(
    'public.fulfill_event_ticket_tier(text, uuid, text, text, integer, integer)'
  ) IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fulfill_event_ticket_tier(text, uuid, text, text, integer, integer)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fulfill_event_ticket_tier(text, uuid, text, text, integer, integer)
      TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fulfill_stripe_checkout_session'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, text, text, integer'
  ) THEN
    REVOKE EXECUTE ON FUNCTION public.fulfill_stripe_checkout_session(uuid, text, text, integer)
      FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure(
    'public.fulfill_stripe_checkout_session(text, uuid, text, text, integer)'
  ) IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.fulfill_stripe_checkout_session(text, uuid, text, text, integer)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.fulfill_stripe_checkout_session(text, uuid, text, text, integer)
      TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.credit_seed_wallet(uuid, integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.credit_seed_wallet(uuid, integer)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.credit_seed_wallet(uuid, integer)
      TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.credit_user_seeds(uuid, integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.credit_user_seeds(uuid, integer)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.credit_user_seeds(uuid, integer)
      TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.process_emote_transaction(uuid, integer, integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.process_emote_transaction(uuid, integer, integer)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.process_emote_transaction(uuid, integer, integer)
      TO service_role;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.reverse_emote_transaction(uuid, integer, integer)') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.reverse_emote_transaction(uuid, integer, integer)
      FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.reverse_emote_transaction(uuid, integer, integer)
      TO service_role;
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- 8. search_path + EXECUTE hardening on trigger/support functions
--    (bodies unchanged — only re-applied where search_path was missing)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF to_regprocedure('public.handle_new_user()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
    ALTER FUNCTION public.handle_new_user() SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.refresh_harvest_progress()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.refresh_harvest_progress() FROM PUBLIC, anon, authenticated;
    GRANT EXECUTE ON FUNCTION public.refresh_harvest_progress() TO service_role;
    ALTER FUNCTION public.refresh_harvest_progress() SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.credit_seed_wallet(uuid, integer)') IS NOT NULL THEN
    ALTER FUNCTION public.credit_seed_wallet(uuid, integer) SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.credit_user_seeds(uuid, integer)') IS NOT NULL THEN
    ALTER FUNCTION public.credit_user_seeds(uuid, integer) SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure(
    'public.fulfill_event_ticket_tier(text, uuid, text, text, integer, integer)'
  ) IS NOT NULL THEN
    ALTER FUNCTION public.fulfill_event_ticket_tier(text, uuid, text, text, integer, integer)
      SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = 'fulfill_stripe_checkout_session'
      AND pg_get_function_identity_arguments(p.oid) = 'uuid, text, text, integer'
  ) THEN
    ALTER FUNCTION public.fulfill_stripe_checkout_session(uuid, text, text, integer)
      SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure(
    'public.fulfill_stripe_checkout_session(text, uuid, text, text, integer)'
  ) IS NOT NULL THEN
    ALTER FUNCTION public.fulfill_stripe_checkout_session(text, uuid, text, text, integer)
      SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.process_emote_transaction(uuid, integer, integer)') IS NOT NULL THEN
    ALTER FUNCTION public.process_emote_transaction(uuid, integer, integer) SET search_path = public;
  END IF;
END $$;

DO $$
BEGIN
  IF to_regprocedure('public.reverse_emote_transaction(uuid, integer, integer)') IS NOT NULL THEN
    ALTER FUNCTION public.reverse_emote_transaction(uuid, integer, integer) SET search_path = public;
  END IF;
END $$;



