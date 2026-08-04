-- =============================================================================
-- Live acknowledgment feed: per-order toast entries on paid fulfillment
-- Fires in parallel with refresh_harvest_progress() on public.orders changes.
-- =============================================================================

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

CREATE INDEX live_acknowledgments_created_at_idx
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

ALTER PUBLICATION supabase_realtime ADD TABLE public.live_acknowledgments;
