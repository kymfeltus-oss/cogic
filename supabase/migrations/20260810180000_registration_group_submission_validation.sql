CREATE OR REPLACE FUNCTION public.validate_registration_submission_fields()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IN ('submitted', 'payment_pending', 'confirmed') THEN
    IF NEW.first_name IS NULL
       OR NEW.last_name IS NULL
       OR NEW.street_address IS NULL
       OR NEW.city IS NULL
       OR NEW.state IS NULL
       OR NEW.postal_code IS NULL
       OR NEW.church_name IS NULL
       OR NEW.pastor_name IS NULL
       OR NEW.jurisdiction IS NULL
    THEN
      RAISE EXCEPTION
        'registration status % requires complete attendee, address, and church fields',
        NEW.status
        USING ERRCODE = 'check_violation';
    END IF;

    IF NEW.is_primary_registrant OR NEW.registration_group_id IS NULL THEN
      IF NEW.email IS NULL
         OR NEW.email !~ '^[^\s@]+@[^\s@]+\.[^\s@]+$'
         OR NEW.mobile_phone IS NULL
      THEN
        RAISE EXCEPTION
          'primary registration status % requires complete contact fields',
          NEW.status
          USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
