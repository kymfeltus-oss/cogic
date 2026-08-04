-- =============================================================================
-- VITAL ORGANS ENTERTAINMENT — WEBHOOK DRIFT REPAIR (CANONICAL, ZERO-GUESS)
-- =============================================================================
-- Run in Supabase Dashboard → SQL Editor on production ONLY after reviewing.
--
-- Source of truth (repo):
--   0002_checkout_fulfillment_rpc.sql      → fulfill_donation_checkout(text)
--   0008_webhook_idempotency_hardening.sql → ticket + merch fulfillment RPCs
--   0009_live_acknowledgments.sql          → live_acknowledgments + trigger
--   0010_final_hardening.sql               → RLS + EXECUTE locks + search_path
--   0001_initial_schema.sql                → refresh_harvest_progress() trigger
--   20260607200000_seed_wallets_and_emotes.sql → resolve_seed_pack_credit()
--
-- Matches app/api/webhooks/stripe/route.ts RPC calls exactly.
-- Does NOT invent new signatures, seed economics, or harvest increment logic.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 0. Remove erroneous overloads from bad manual scripts (safe if absent)
-- ---------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.fulfill_donation_checkout(uuid, text, integer, text);
DROP FUNCTION IF EXISTS public.fulfill_stripe_checkout_session(uuid, text, text, integer);
-- Legacy partial hardening overload (5-arg, missing p_selected_size)
DROP FUNCTION IF EXISTS public.fulfill_stripe_checkout_session(text, uuid, text, text, integer);

-- ---------------------------------------------------------------------------
-- 1. Donation fulfillment (0002) — webhook: { p_stripe_session_id }
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fulfill_donation_checkout(
  p_stripe_session_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.donations
  SET status = 'paid'
  WHERE stripe_session_id = p_stripe_session_id
    AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Donation record not found or already fulfilled: %', p_stripe_session_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Seed helpers (0005 alias + seed-pack resolver)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 3. Webhook fulfillment RPCs (0008) — idempotent paid short-circuit
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 4. Harvest progress — statement trigger (0001), NOT incremental ack math
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_harvest_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.harvest_progress
  SET
    total_cents = (
      SELECT COALESCE(SUM(amount_total), 0)::bigint
      FROM public.orders
      WHERE status = 'paid'
    ),
    updated_at = timezone('utc', now())
  WHERE id = 1;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_refresh_harvest ON public.orders;

CREATE TRIGGER trg_orders_refresh_harvest
  AFTER INSERT OR UPDATE OF status, amount_total ON public.orders
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_harvest_progress();

-- One-time recompute if drift accumulated (idempotent)
UPDATE public.harvest_progress
SET
  total_cents = (
    SELECT COALESCE(SUM(amount_total), 0)::bigint
    FROM public.orders
    WHERE status = 'paid'
  ),
  updated_at = timezone('utc', now())
WHERE id = 1;

-- ---------------------------------------------------------------------------
-- 5. Live acknowledgments (0009) — table, trigger, RLS, realtime
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

COMMENT ON TABLE public.live_acknowledgments IS
  'Scrolling live-room acknowledgment toasts emitted when orders transition to paid.';

CREATE OR REPLACE FUNCTION public.enqueue_live_acknowledgment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name text;
  v_message text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'paid' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND COALESCE(OLD.status, '') = 'paid' THEN
    RETURN NEW;
  END IF;

  v_display_name := split_part(lower(trim(NEW.email)), '@', 1);

  IF char_length(v_display_name) = 0 THEN
    v_display_name := 'Fan';
  ELSIF char_length(v_display_name) > 18 THEN
    v_display_name := left(v_display_name, 16) || '…';
  END IF;

  v_message := v_display_name || ' joined the Awakening Harvest';

  INSERT INTO public.live_acknowledgments (
    order_id,
    display_name,
    product_type,
    amount_total,
    message
  )
  VALUES (
    NEW.id,
    v_display_name,
    NEW.product_type,
    NEW.amount_total,
    v_message
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_live_acknowledgment ON public.orders;

CREATE TRIGGER trg_orders_live_acknowledgment
  AFTER INSERT OR UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.enqueue_live_acknowledgment();

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
-- 6. Donations RLS restore (0010 §3)
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
-- 7. EXECUTE locks + search_path (0010 §7–8, corrected 6-arg webhook signature)
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.fulfill_donation_checkout(text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fulfill_event_ticket_tier(text, uuid, text, text, integer, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.fulfill_stripe_checkout_session(text, uuid, text, text, integer, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.credit_seed_wallet(uuid, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.credit_user_seeds(uuid, integer)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.refresh_harvest_progress()
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.fulfill_donation_checkout(text) TO service_role;

GRANT EXECUTE ON FUNCTION public.fulfill_event_ticket_tier(text, uuid, text, text, integer, integer)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.fulfill_stripe_checkout_session(text, uuid, text, text, integer, text)
  TO service_role;

GRANT EXECUTE ON FUNCTION public.credit_seed_wallet(uuid, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.credit_user_seeds(uuid, integer) TO service_role;

GRANT EXECUTE ON FUNCTION public.refresh_harvest_progress() TO service_role;

ALTER FUNCTION public.fulfill_donation_checkout(text) SET search_path = public;
ALTER FUNCTION public.fulfill_event_ticket_tier(text, uuid, text, text, integer, integer)
  SET search_path = public;
ALTER FUNCTION public.fulfill_stripe_checkout_session(text, uuid, text, text, integer, text)
  SET search_path = public;
ALTER FUNCTION public.credit_seed_wallet(uuid, integer) SET search_path = public;
ALTER FUNCTION public.credit_user_seeds(uuid, integer) SET search_path = public;
ALTER FUNCTION public.enqueue_live_acknowledgment() SET search_path = public;
ALTER FUNCTION public.refresh_harvest_progress() SET search_path = public;

COMMIT;

-- Post-run verification (run separately):
-- SELECT proname, pg_get_function_identity_arguments(oid)
-- FROM pg_proc
-- WHERE proname IN (
--   'fulfill_donation_checkout',
--   'fulfill_stripe_checkout_session',
--   'fulfill_event_ticket_tier',
--   'enqueue_live_acknowledgment'
-- )
-- ORDER BY 1, 2;
