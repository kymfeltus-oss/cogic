-- Profile avatar URL + storage bucket for attendee profile photos.

ALTER TABLE public.attendees
  ADD COLUMN IF NOT EXISTS avatar_url text;

COMMENT ON COLUMN public.attendees.avatar_url IS
  'Public URL for attendee profile photo in profile-avatars storage bucket.';

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.attendees (id, email, is_guest, first_name, last_name, avatar_url)
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    COALESCE((NEW.raw_user_meta_data ->> 'is_guest')::boolean, false),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'first_name', NEW.raw_user_meta_data ->> 'firstName', '')), ''),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'last_name', NEW.raw_user_meta_data ->> 'lastName', '')), ''),
    nullif(trim(COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NEW.raw_user_meta_data ->> 'avatarUrl', '')), '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    is_guest = EXCLUDED.is_guest,
    first_name = COALESCE(EXCLUDED.first_name, public.attendees.first_name),
    last_name = COALESCE(EXCLUDED.last_name, public.attendees.last_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.attendees.avatar_url);

  RETURN NEW;
END;
$$;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-avatars',
  'profile-avatars',
  true,
  2097152,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS profile_avatars_public_read ON storage.objects;
CREATE POLICY profile_avatars_public_read
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'profile-avatars');

DROP POLICY IF EXISTS profile_avatars_insert_own ON storage.objects;
CREATE POLICY profile_avatars_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_update_own ON storage.objects;
CREATE POLICY profile_avatars_update_own
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS profile_avatars_delete_own ON storage.objects;
CREATE POLICY profile_avatars_delete_own
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'profile-avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
