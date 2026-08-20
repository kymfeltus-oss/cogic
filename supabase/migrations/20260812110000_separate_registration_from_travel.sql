-- Registration owns registration commerce; COGIC Travel owns housing/travel.
-- Historical housing, reservations, transactions, and audits are untouched.

UPDATE public.registrations SET draft_last_step='review' WHERE draft_last_step='housing';
ALTER TABLE public.registrations DROP CONSTRAINT IF EXISTS registrations_draft_last_step_check;
ALTER TABLE public.registrations ADD CONSTRAINT registrations_draft_last_step_check CHECK (
  draft_last_step IS NULL OR draft_last_step IN ('attendee','product','group','policy','review','payment')
);

UPDATE public.registration_groups SET wizard_resume_step = CASE
  WHEN status='confirmed' THEN 7
  WHEN status IN ('submitted','payment_pending') THEN 6
  WHEN wizard_resume_step>=6 THEN wizard_resume_step-1
  ELSE wizard_resume_step END;
ALTER TABLE public.registration_groups DROP CONSTRAINT IF EXISTS registration_groups_wizard_resume_step_check;
ALTER TABLE public.registration_groups ADD CONSTRAINT registration_groups_wizard_resume_step_check
  CHECK (wizard_resume_step BETWEEN 1 AND 7);

CREATE OR REPLACE FUNCTION public._registration_step_to_resume(p_step text)
RETURNS integer LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE lower(coalesce(p_step,''))
    WHEN 'attendee' THEN 1 WHEN 'product' THEN 2 WHEN 'group' THEN 3
    WHEN 'policy' THEN 4 WHEN 'review' THEN 5 WHEN 'payment' THEN 6 ELSE 1 END;
$$;

CREATE OR REPLACE FUNCTION public.normalize_registration_only_resume_step()
RETURNS trigger LANGUAGE plpgsql SET search_path=public,pg_temp AS $$
BEGIN
  NEW.wizard_resume_step := CASE
    WHEN NEW.status='confirmed' THEN 7
    WHEN NEW.status IN ('submitted','payment_pending') THEN 6
    ELSE LEAST(NEW.wizard_resume_step,6) END;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS registration_groups_normalize_registration_only_resume ON public.registration_groups;
CREATE TRIGGER registration_groups_normalize_registration_only_resume
BEFORE INSERT OR UPDATE OF status,wizard_resume_step ON public.registration_groups
FOR EACH ROW EXECUTE FUNCTION public.normalize_registration_only_resume_step();

UPDATE public.registration_products SET description=
  'Required 2-night stay. Housing available for 2 nights only with this pass. Please note: No other registration materials are included with this pass. Important: This pass only allows 2 nights of housing. If you need more than 2 nights, please select a different registration type.'
WHERE program_key='cogic-stream-2026' AND product_key='TWO_NIGHT_EXPERIENCE_PASS_2026';

COMMENT ON COLUMN public.registration_groups.wizard_resume_step IS
  'Registration-only mobile wizard: 1 attendee, 2 product, 3 group, 4 policy, 5 review, 6 payment, 7 complete. Housing/travel are managed by COGIC Travel.';
