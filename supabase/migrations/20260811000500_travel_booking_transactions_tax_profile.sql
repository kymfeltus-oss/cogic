-- Persist verified church tax-exempt profile id on marketplace ledger rows for audit.

ALTER TABLE public.travel_booking_transactions
  ADD COLUMN IF NOT EXISTS tax_profile_id uuid NULL
    REFERENCES public.church_tax_profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS travel_booking_transactions_tax_profile_idx
  ON public.travel_booking_transactions (tax_profile_id)
  WHERE tax_profile_id IS NOT NULL;

COMMENT ON COLUMN public.travel_booking_transactions.tax_profile_id IS
  'Set only when server-verified church_tax_profiles.verification_status = verified was applied at PaymentIntent creation. Never client-supplied.';
