-- Phase 2: 501(c)(3) tax-exempt profiling for church organizations.
-- Certificate objects live in a PRIVATE storage bucket. Uploads/downloads are intended
-- to go through Next.js APIs using service_role signed URLs — never public object URLs.
-- Verification status is server-authoritative (owner review); clients cannot self-verify.

-- ---------------------------------------------------------------------------
-- church_tax_profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.church_tax_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id uuid NOT NULL REFERENCES public.church_organizations (id) ON DELETE CASCADE,
  legal_name text NOT NULL
    CHECK (char_length(trim(legal_name)) >= 2),
  -- US EIN format NN-NNNNNNN (digits + hyphen only). Never accept client "verified" flags.
  ein text NOT NULL
    CHECK (ein ~ '^[0-9]{2}-[0-9]{7}$'),
  verification_status text NOT NULL DEFAULT 'pending_upload'
    CHECK (verification_status IN (
      'pending_upload',
      'pending_review',
      'verified',
      'rejected',
      'expired'
    )),
  certificate_bucket text NOT NULL DEFAULT 'tax-exempt-certificates'
    CHECK (certificate_bucket = 'tax-exempt-certificates'),
  -- Object key layout: {church_id}/{profile_id}/{object_name}
  certificate_object_path text NULL
    CHECK (
      certificate_object_path IS NULL
      OR char_length(trim(certificate_object_path)) >= 8
    ),
  certificate_content_type text NULL
    CHECK (
      certificate_content_type IS NULL
      OR certificate_content_type IN (
        'application/pdf',
        'image/jpeg',
        'image/png'
      )
    ),
  certificate_byte_size integer NULL
    CHECK (certificate_byte_size IS NULL OR (certificate_byte_size > 0 AND certificate_byte_size <= 10485760)),
  certificate_sha256 text NULL
    CHECK (
      certificate_sha256 IS NULL
      OR certificate_sha256 ~ '^[a-f0-9]{64}$'
    ),
  uploaded_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  uploaded_at timestamptz NULL,
  reviewed_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz NULL,
  rejection_reason text NULL
    CHECK (
      rejection_reason IS NULL
      OR char_length(trim(rejection_reason)) >= 3
    ),
  expires_on date NULL,
  owner_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT church_tax_profiles_church_unique UNIQUE (church_id),
  CONSTRAINT church_tax_profiles_review_requires_path
    CHECK (
      verification_status = 'pending_upload'
      OR certificate_object_path IS NOT NULL
    ),
  CONSTRAINT church_tax_profiles_verified_requires_reviewer
    CHECK (
      verification_status <> 'verified'
      OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    ),
  CONSTRAINT church_tax_profiles_rejected_requires_reason
    CHECK (
      verification_status <> 'rejected'
      OR (
        rejection_reason IS NOT NULL
        AND reviewed_by IS NOT NULL
        AND reviewed_at IS NOT NULL
      )
    )
);

COMMENT ON TABLE public.church_tax_profiles IS
  'Per-church 501(c)(3) tax-exempt profile. Certificate files are private; verification is owner-reviewed only.';

COMMENT ON COLUMN public.church_tax_profiles.ein IS
  'Employer Identification Number (NN-NNNNNNN). Sensitive — RLS restricts to leadership/owners; APIs should redact where possible.';

COMMENT ON COLUMN public.church_tax_profiles.certificate_object_path IS
  'Private storage object key in tax-exempt-certificates. Never expose as a permanent public URL.';

COMMENT ON COLUMN public.church_tax_profiles.verification_status IS
  'pending_upload → pending_review → verified|rejected|expired. Clients cannot stamp verified.';

CREATE INDEX IF NOT EXISTS church_tax_profiles_status_idx
  ON public.church_tax_profiles (verification_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS church_tax_profiles_ein_idx
  ON public.church_tax_profiles (ein);

DROP TRIGGER IF EXISTS church_tax_profiles_set_updated_at ON public.church_tax_profiles;
CREATE TRIGGER church_tax_profiles_set_updated_at
  BEFORE UPDATE ON public.church_tax_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.church_tax_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_tax_profiles FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.church_tax_profiles FROM PUBLIC, anon;

-- Members may read their church tax profile metadata (not via public storage URLs).
GRANT SELECT ON public.church_tax_profiles TO authenticated;
-- Mutations go through service_role API handlers (session org + owner authority).
GRANT ALL ON public.church_tax_profiles TO service_role;

DROP POLICY IF EXISTS church_tax_profiles_select_member_or_owner
  ON public.church_tax_profiles;
CREATE POLICY church_tax_profiles_select_member_or_owner
  ON public.church_tax_profiles
  FOR SELECT
  TO authenticated
  USING (
    public.is_application_owner()
    OR EXISTS (
      SELECT 1
      FROM public.church_memberships m
      WHERE m.church_id = church_tax_profiles.church_id
        AND m.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Optional link from group booking requests (checkout exemption claim later)
-- ---------------------------------------------------------------------------

ALTER TABLE public.travel_group_booking_requests
  ADD COLUMN IF NOT EXISTS tax_profile_id uuid NULL
    REFERENCES public.church_tax_profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS travel_group_booking_requests_tax_profile_idx
  ON public.travel_group_booking_requests (tax_profile_id)
  WHERE tax_profile_id IS NOT NULL;

COMMENT ON COLUMN public.travel_group_booking_requests.tax_profile_id IS
  'Optional link to church_tax_profiles when a corporate request claims tax-exempt handling. Exemption eligibility is server-evaluated from verification_status — never client-asserted.';

-- ---------------------------------------------------------------------------
-- Private storage bucket: tax-exempt-certificates
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tax-exempt-certificates',
  'tax-exempt-certificates',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png']::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path helper: first folder segment must be church_organizations.id
CREATE OR REPLACE FUNCTION public.tax_cert_path_church_id(object_name text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  v_folder text;
  v_church_id uuid;
BEGIN
  v_folder := (storage.foldername(object_name))[1];
  IF v_folder IS NULL OR v_folder = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_church_id := v_folder::uuid;
  EXCEPTION
    WHEN invalid_text_representation THEN
      RETURN NULL;
  END;
  RETURN v_church_id;
END;
$$;

COMMENT ON FUNCTION public.tax_cert_path_church_id(text) IS
  'Extracts church_id UUID from tax-exempt-certificates object path prefix {church_id}/...';

REVOKE ALL ON FUNCTION public.tax_cert_path_church_id(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tax_cert_path_church_id(text) TO authenticated, service_role;

-- No anon access. Authenticated: leadership/owners may SELECT objects for their church.
-- INSERT/UPDATE/DELETE for authenticated are denied — APIs use service_role signed upload/download.

DROP POLICY IF EXISTS tax_exempt_certificates_select_leader_or_owner ON storage.objects;
CREATE POLICY tax_exempt_certificates_select_leader_or_owner
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'tax-exempt-certificates'
    AND (
      public.is_application_owner()
      OR public.is_church_leadership_member(public.tax_cert_path_church_id(name))
    )
  );

DROP POLICY IF EXISTS tax_exempt_certificates_service_all ON storage.objects;
CREATE POLICY tax_exempt_certificates_service_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'tax-exempt-certificates')
  WITH CHECK (bucket_id = 'tax-exempt-certificates');
