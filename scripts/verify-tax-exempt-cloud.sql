-- Operator verification: tax-exempt upload infrastructure (migration 20260811000400).
-- Run in Supabase SQL editor against the SAME project your Next.js app uses.
-- Expected: each check returns at least one row; zero rows = BLOCKED for upload POST.

-- 1) Table exists
SELECT to_regclass('public.church_tax_profiles') AS church_tax_profiles_table;

-- 2) Leadership helper (required by storage RLS)
SELECT proname
FROM pg_proc
WHERE proname = 'is_church_leadership_member';

-- 3) Path parser for storage policies
SELECT proname
FROM pg_proc
WHERE proname = 'tax_cert_path_church_id';

-- 4) Private bucket row
SELECT id, public, file_size_limit, allowed_mime_types
FROM storage.buckets
WHERE id = 'tax-exempt-certificates';

-- 5) RLS enabled on profiles
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class
WHERE oid = 'public.church_tax_profiles'::regclass;

-- 6) Storage object policies for tax-exempt bucket
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemename = 'storage'
  AND tablename = 'objects'
  AND policyname LIKE 'tax_exempt_certificates%';

-- 7) Table SELECT policy
SELECT policyname, roles, cmd
FROM pg_policies
WHERE schemename = 'public'
  AND tablename = 'church_tax_profiles';

-- 8) Sample profile count (informational)
SELECT verification_status, count(*) AS rows
FROM public.church_tax_profiles
GROUP BY verification_status
ORDER BY verification_status;
