-- Phase 0 foundation: local church organizations + membership roles.
-- Application owners manage rows via ADMIN_EMAILS-gated Next.js APIs using service_role
-- (bypasses RLS). JWT owner policies mirror ADMIN_EMAILS via app.admin_emails GUC
-- and/or app_metadata.is_application_owner for defense-in-depth on the authenticated role.

-- ---------------------------------------------------------------------------
-- Application owner helper (ADMIN_EMAILS mirror)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_application_owner()
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text := lower(trim(COALESCE(auth.jwt() ->> 'email', '')));
  v_allowlist text := COALESCE(NULLIF(current_setting('app.admin_emails', true), ''), '');
  v_claim text := lower(trim(COALESCE(auth.jwt() -> 'app_metadata' ->> 'is_application_owner', '')));
BEGIN
  -- Explicit JWT claim (optional; set only by trusted server auth hooks).
  IF v_claim IN ('true', '1', 'yes') THEN
    RETURN true;
  END IF;

  IF v_email = '' OR v_allowlist = '' THEN
    RETURN false;
  END IF;

  -- Comma-separated allowlist mirroring process.env.ADMIN_EMAILS.
  -- Configure in Supabase, e.g.:
  --   ALTER ROLE authenticator SET app.admin_emails = 'owner@example.org,ops@example.org';
  RETURN EXISTS (
    SELECT 1
    FROM unnest(string_to_array(v_allowlist, ',')) AS admin_email(raw)
    WHERE lower(trim(admin_email.raw)) = v_email
      AND length(trim(admin_email.raw)) > 0
  );
END;
$$;

COMMENT ON FUNCTION public.is_application_owner() IS
  'True when the JWT email is in app.admin_emails (ADMIN_EMAILS mirror) or app_metadata.is_application_owner is set. Owner APIs also use service_role.';

REVOKE ALL ON FUNCTION public.is_application_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_application_owner() TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- church_organizations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.church_organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL
    CHECK (char_length(trim(name)) > 0),
  jurisdiction_id text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

COMMENT ON TABLE public.church_organizations IS
  'Local church organizations for corporate travel and membership roles.';

COMMENT ON COLUMN public.church_organizations.jurisdiction_id IS
  'Optional jurisdiction identifier (text). Not yet a foreign key — directory model TBD.';

DROP TRIGGER IF EXISTS church_organizations_set_updated_at ON public.church_organizations;
CREATE TRIGGER church_organizations_set_updated_at
  BEFORE UPDATE ON public.church_organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- ---------------------------------------------------------------------------
-- church_memberships
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.church_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  church_id uuid NOT NULL REFERENCES public.church_organizations (id) ON DELETE CASCADE,
  role text NOT NULL
    CHECK (role IN ('Pastor', 'Overseer', 'Traveler')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT church_memberships_user_church_unique UNIQUE (user_id, church_id)
);

COMMENT ON TABLE public.church_memberships IS
  'Links auth.users to church_organizations with role Pastor | Overseer | Traveler.';

COMMENT ON COLUMN public.church_memberships.role IS
  'Application church role. Distinct from owner ADMIN_EMAILS and registration free-text pastor_name.';

DROP TRIGGER IF EXISTS church_memberships_set_updated_at ON public.church_memberships;
CREATE TRIGGER church_memberships_set_updated_at
  BEFORE UPDATE ON public.church_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

-- ---------------------------------------------------------------------------
-- Leadership helper (requires church_memberships)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_church_leadership_member(p_church_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.church_memberships m
    WHERE m.church_id = p_church_id
      AND m.user_id = auth.uid()
      AND m.role IN ('Pastor', 'Overseer')
  );
$$;

COMMENT ON FUNCTION public.is_church_leadership_member(uuid) IS
  'True when the session user is Pastor or Overseer for the given church_organizations.id.';

REVOKE ALL ON FUNCTION public.is_church_leadership_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_church_leadership_member(uuid) TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS church_memberships_user_church_idx
  ON public.church_memberships (user_id, church_id);

CREATE INDEX IF NOT EXISTS church_memberships_church_role_idx
  ON public.church_memberships (church_id, role);

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

ALTER TABLE public.church_organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_organizations FORCE ROW LEVEL SECURITY;
ALTER TABLE public.church_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.church_memberships FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.church_organizations FROM PUBLIC, anon;
REVOKE ALL ON public.church_memberships FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_organizations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.church_memberships TO authenticated;

GRANT ALL ON public.church_organizations TO service_role;
GRANT ALL ON public.church_memberships TO service_role;

-- ---------------------------------------------------------------------------
-- RLS: church_memberships
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS church_memberships_select_own ON public.church_memberships;
CREATE POLICY church_memberships_select_own
  ON public.church_memberships
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_application_owner()
    OR public.is_church_leadership_member(church_id)
  );

DROP POLICY IF EXISTS church_memberships_insert_owner_or_leader ON public.church_memberships;
CREATE POLICY church_memberships_insert_owner_or_leader
  ON public.church_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_application_owner()
    OR public.is_church_leadership_member(church_id)
  );

DROP POLICY IF EXISTS church_memberships_update_owner_or_leader ON public.church_memberships;
CREATE POLICY church_memberships_update_owner_or_leader
  ON public.church_memberships
  FOR UPDATE
  TO authenticated
  USING (
    public.is_application_owner()
    OR public.is_church_leadership_member(church_id)
  )
  WITH CHECK (
    public.is_application_owner()
    OR public.is_church_leadership_member(church_id)
  );

DROP POLICY IF EXISTS church_memberships_delete_owner_or_leader ON public.church_memberships;
CREATE POLICY church_memberships_delete_owner_or_leader
  ON public.church_memberships
  FOR DELETE
  TO authenticated
  USING (
    public.is_application_owner()
    OR public.is_church_leadership_member(church_id)
  );

-- ---------------------------------------------------------------------------
-- RLS: church_organizations
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS church_organizations_select_member_or_owner ON public.church_organizations;
CREATE POLICY church_organizations_select_member_or_owner
  ON public.church_organizations
  FOR SELECT
  TO authenticated
  USING (
    public.is_application_owner()
    OR EXISTS (
      SELECT 1
      FROM public.church_memberships m
      WHERE m.church_id = church_organizations.id
        AND m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS church_organizations_insert_owner ON public.church_organizations;
CREATE POLICY church_organizations_insert_owner
  ON public.church_organizations
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_application_owner());

-- Organization settings: UPDATE/DELETE restricted to Pastor/Overseer of that org,
-- or application owners (ADMIN_EMAILS mirror).
DROP POLICY IF EXISTS church_organizations_update_leader_or_owner ON public.church_organizations;
CREATE POLICY church_organizations_update_leader_or_owner
  ON public.church_organizations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_application_owner()
    OR public.is_church_leadership_member(id)
  )
  WITH CHECK (
    public.is_application_owner()
    OR public.is_church_leadership_member(id)
  );

DROP POLICY IF EXISTS church_organizations_delete_leader_or_owner ON public.church_organizations;
CREATE POLICY church_organizations_delete_leader_or_owner
  ON public.church_organizations
  FOR DELETE
  TO authenticated
  USING (
    public.is_application_owner()
    OR public.is_church_leadership_member(id)
  );
