-- COGIC LIVE Registration Slice 2: attendee snapshots, groups, juniors, policies.
-- Target project: wjlaaluonxiaxmytiqwi. No products, people, or policy text seeded.

CREATE TABLE IF NOT EXISTS public.registration_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','payment_pending','confirmed','canceled')),
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_key, owner_user_id)
);

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS registration_group_id uuid NULL REFERENCES public.registration_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_primary_registrant boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS relationship_to_primary text NULL,
  ADD COLUMN IF NOT EXISTS guardian_registration_id uuid NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS salutation text NULL,
  ADD COLUMN IF NOT EXISTS suffix text NULL,
  ADD COLUMN IF NOT EXISTS assistant_email text NULL,
  ADD COLUMN IF NOT EXISTS address_line_2 text NULL,
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT 'US',
  ADD COLUMN IF NOT EXISTS gender text NULL,
  ADD COLUMN IF NOT EXISTS requires_interpretation boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preferred_language text NULL,
  ADD COLUMN IF NOT EXISTS date_of_birth date NULL;

CREATE TABLE IF NOT EXISTS public.registration_policies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  version text NOT NULL, title text NOT NULL, content text NOT NULL,
  content_hash text NOT NULL, effective_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','superseded','retired')),
  published_at timestamptz NULL, superseded_at timestamptz NULL,
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_key, version),
  CONSTRAINT published_policy_immutable CHECK (status <> 'published' OR published_at IS NOT NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS registration_policies_one_published_idx ON public.registration_policies(program_key) WHERE status='published';

CREATE TABLE IF NOT EXISTS public.registration_policy_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), registration_group_id uuid NOT NULL REFERENCES public.registration_groups(id) ON DELETE CASCADE,
  policy_id uuid NOT NULL REFERENCES public.registration_policies(id) ON DELETE RESTRICT,
  policy_version text NOT NULL, policy_content_hash text NOT NULL, policy_snapshot text NOT NULL,
  authorized_signer_name text NOT NULL, agreement_signer_name text NOT NULL,
  accepted_by_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  accepted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(registration_group_id, policy_id)
);

CREATE INDEX IF NOT EXISTS registrations_group_idx ON public.registrations(registration_group_id);
CREATE INDEX IF NOT EXISTS registrations_product_status_idx ON public.registrations(registration_product_id,status);
CREATE INDEX IF NOT EXISTS registrations_interpretation_idx ON public.registrations(requires_interpretation) WHERE requires_interpretation=true;
CREATE UNIQUE INDEX IF NOT EXISTS registrations_one_primary_per_group_idx ON public.registrations(registration_group_id) WHERE is_primary_registrant=true;

DROP TRIGGER IF EXISTS registration_groups_set_updated_at ON public.registration_groups;
CREATE TRIGGER registration_groups_set_updated_at BEFORE UPDATE ON public.registration_groups FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
DROP TRIGGER IF EXISTS registration_policies_set_updated_at ON public.registration_policies;
CREATE TRIGGER registration_policies_set_updated_at BEFORE UPDATE ON public.registration_policies FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.registration_groups ENABLE ROW LEVEL SECURITY; ALTER TABLE public.registration_groups FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registration_policies ENABLE ROW LEVEL SECURITY; ALTER TABLE public.registration_policies FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registration_policy_acceptances ENABLE ROW LEVEL SECURITY; ALTER TABLE public.registration_policy_acceptances FORCE ROW LEVEL SECURITY;
REVOKE ALL ON public.registration_groups, public.registration_policies, public.registration_policy_acceptances FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.registration_groups, public.registration_policies, public.registration_policy_acceptances TO service_role;

CREATE OR REPLACE FUNCTION public.prevent_published_policy_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status IN ('published','superseded','retired') AND (NEW.title,NEW.content,NEW.content_hash,NEW.version,NEW.effective_at) IS DISTINCT FROM (OLD.title,OLD.content,OLD.content_hash,OLD.version,OLD.effective_at) THEN
    RAISE EXCEPTION 'Published policy content is immutable; create a new version';
  END IF; RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS registration_policy_immutable ON public.registration_policies;
CREATE TRIGGER registration_policy_immutable BEFORE UPDATE ON public.registration_policies FOR EACH ROW EXECUTE FUNCTION public.prevent_published_policy_mutation();
