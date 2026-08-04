-- Attendee contact + location fields for create-account onboarding.

ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS state text;

COMMENT ON COLUMN public.attendees.phone IS
  'Normalized 10-digit US phone captured at account registration.';
COMMENT ON COLUMN public.attendees.city IS
  'Attendee city captured at account registration.';
COMMENT ON COLUMN public.attendees.state IS
  'Two-letter US state code captured at account registration.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.attendees (
    id,
    email,
    is_guest,
    first_name,
    last_name,
    avatar_url,
    phone,
    city,
    state
  )
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    COALESCE((NEW.raw_user_meta_data ->> 'is_guest')::boolean, false),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'firstName', '')), ''),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'last_name', NEW.raw_user_meta_data ->> 'lastName', '')), ''),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'avatarUrl', '')), ''),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'phone', '')), ''),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'city', '')), ''),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'state', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    is_guest = EXCLUDED.is_guest,
    first_name = COALESCE(EXCLUDED.first_name, public.attendees.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.attendees.last_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.attendees.avatar_url),
    phone = COALESCE(EXCLUDED.phone, public.attendees.phone),
    city = COALESCE(EXCLUDED.city, public.attendees.city),
    state = COALESCE(EXCLUDED.state, public.attendees.state);

  RETURN NEW;
END;
$$;

UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'profile-avatars';
