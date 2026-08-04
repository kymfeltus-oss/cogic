-- Profile names for attendee identity (profile orb initials, welcome header).

ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.attendees.first_name IS
  'Attendee first name — synced from auth.users.raw_user_meta_data on signup/login.';
COMMENT ON COLUMN public.attendees.last_name IS
  'Attendee last name — synced from auth.users.raw_user_meta_data on signup/login.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.attendees (id, email, is_guest, first_name, last_name)
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    COALESCE((NEW.raw_user_meta_data ->> 'is_guest')::boolean, false),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'firstName', '')), ''),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'last_name', NEW.raw_user_meta_data ->> 'lastName', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    is_guest = EXCLUDED.is_guest,
    first_name = COALESCE(EXCLUDED.first_name, public.attendees.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.attendees.last_name);

  RETURN NEW;
END;
$$;
