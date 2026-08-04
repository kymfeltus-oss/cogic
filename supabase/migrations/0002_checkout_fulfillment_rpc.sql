-- Atomic Stripe checkout fulfillment (orders + attendees, donations ledger).
-- Invoked by app/api/webhooks/stripe/route.ts via service_role.

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

CREATE OR REPLACE FUNCTION public.fulfill_merch_checkout(
  p_user_id uuid,
  p_email text,
  p_product_type text,
  p_amount_total integer,
  p_stripe_session_id text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(p_email));
BEGIN
  IF v_email IS NULL OR char_length(v_email) = 0 THEN
    RAISE EXCEPTION 'Merch fulfillment requires a non-empty email.';
  END IF;

  IF p_product_type IS NULL OR char_length(trim(p_product_type)) = 0 THEN
    RAISE EXCEPTION 'Merch fulfillment requires product_type.';
  END IF;

  IF p_amount_total IS NULL OR p_amount_total <= 0 THEN
    RAISE EXCEPTION 'Merch fulfillment requires a positive amount_total.';
  END IF;

  UPDATE public.orders
  SET
    status = 'paid',
    user_id = p_user_id,
    email = v_email,
    product_type = p_product_type
  WHERE stripe_session_id = p_stripe_session_id
    AND status = 'pending';

  IF NOT FOUND THEN
    INSERT INTO public.orders (
      user_id,
      email,
      product_type,
      amount_total,
      status,
      stripe_session_id
    )
    VALUES (
      p_user_id,
      v_email,
      p_product_type,
      p_amount_total,
      'paid',
      p_stripe_session_id
    )
    ON CONFLICT (stripe_session_id) DO UPDATE SET
      status = 'paid',
      user_id = EXCLUDED.user_id,
      email = EXCLUDED.email,
      product_type = EXCLUDED.product_type;
  END IF;

  UPDATE public.attendees
  SET email = v_email
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO public.attendees (id, email, is_guest)
    VALUES (p_user_id, v_email, false)
    ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_donation_checkout(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fulfill_merch_checkout(uuid, text, text, integer, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.fulfill_donation_checkout(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.fulfill_merch_checkout(uuid, text, text, integer, text) TO service_role;
