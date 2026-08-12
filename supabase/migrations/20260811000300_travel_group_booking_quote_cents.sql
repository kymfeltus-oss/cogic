-- Add negotiated quote amount for corporate group booking requests.
-- Quote cents are owner-entered only; never invented client-side.

ALTER TABLE public.travel_group_booking_requests
  ADD COLUMN IF NOT EXISTS allocated_quote_cents integer NULL
    CHECK (allocated_quote_cents IS NULL OR allocated_quote_cents >= 0);

COMMENT ON COLUMN public.travel_group_booking_requests.allocated_quote_cents IS
  'Owner-entered negotiated quote in USD cents. Null until assigned.';
