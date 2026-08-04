-- ====================================================================
-- PRODUCTION FINTECH CORE: ATOMIC TRANSACTION FULFILLMENT RPC ENGINE
-- ====================================================================
-- Invoked by app/api/webhooks/stripe/route.ts via service_role.
-- Upserting into public.orders fires public.refresh_harvest_progress().

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
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_stripe_checkout_session(
  text, uuid, text, text, integer, text
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fulfill_stripe_checkout_session(
  text, uuid, text, text, integer, text
) TO service_role;
