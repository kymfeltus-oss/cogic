-- Down migration for 20260801123000_registrations_and_registration_payments.sql
-- Target: vital-organs-entertainment (tezzihhkqlovynybaypu)

DROP FUNCTION IF EXISTS public.fulfill_registration_checkout(text, text);

DROP POLICY IF EXISTS registration_payments_select_own ON public.registration_payments;
DROP POLICY IF EXISTS registrations_select_own ON public.registrations;

DROP TRIGGER IF EXISTS registration_payments_set_updated_at ON public.registration_payments;
DROP TABLE IF EXISTS public.registration_payments;

DROP TRIGGER IF EXISTS registrations_validate_status_transition ON public.registrations;
DROP TRIGGER IF EXISTS registrations_validate_submission ON public.registrations;
DROP TRIGGER IF EXISTS registrations_normalize_row ON public.registrations;
DROP TRIGGER IF EXISTS registrations_set_updated_at ON public.registrations;

DROP FUNCTION IF EXISTS public.validate_registration_status_transition();
DROP FUNCTION IF EXISTS public.validate_registration_submission_fields();
DROP FUNCTION IF EXISTS public.normalize_registration_row();

DROP TABLE IF EXISTS public.registrations;
