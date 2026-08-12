-- Phase 1: corporate travel group booking requests (10+ party).
-- church_id and requester_id are always stamped server-side from session org context.

CREATE TABLE IF NOT EXISTS public.travel_group_booking_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  church_id uuid NOT NULL REFERENCES public.church_organizations (id) ON DELETE RESTRICT,
  requester_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE RESTRICT,
  party_size integer NOT NULL
    CHECK (party_size >= 10),
  travel_type text NOT NULL
    CHECK (travel_type IN ('hotel', 'flight', 'car', 'multi')),
  destination text NOT NULL
    CHECK (char_length(trim(destination)) >= 2),
  departure_date date NOT NULL,
  return_date date NOT NULL,
  internal_notes text NULL,
  status text NOT NULL DEFAULT 'pending_quote'
    CHECK (status IN (
      'pending_quote',
      'quoted',
      'approved',
      'rejected',
      'canceled',
      'fulfilled'
    )),
  owner_notes text NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT travel_group_booking_requests_dates_ordered
    CHECK (return_date >= departure_date)
);

CREATE INDEX IF NOT EXISTS travel_group_booking_requests_church_created_idx
  ON public.travel_group_booking_requests (church_id, created_at DESC);

CREATE INDEX IF NOT EXISTS travel_group_booking_requests_status_idx
  ON public.travel_group_booking_requests (status, created_at DESC);

CREATE INDEX IF NOT EXISTS travel_group_booking_requests_requester_idx
  ON public.travel_group_booking_requests (requester_id, created_at DESC);

DROP TRIGGER IF EXISTS travel_group_booking_requests_set_updated_at
  ON public.travel_group_booking_requests;
CREATE TRIGGER travel_group_booking_requests_set_updated_at
  BEFORE UPDATE ON public.travel_group_booking_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.travel_group_booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.travel_group_booking_requests FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.travel_group_booking_requests FROM PUBLIC, anon;

-- Authenticated members may read requests for churches they belong to.
GRANT SELECT ON public.travel_group_booking_requests TO authenticated;

-- Mutations go through service_role API handlers (session org authority).
GRANT ALL ON public.travel_group_booking_requests TO service_role;

DROP POLICY IF EXISTS travel_group_booking_requests_select_member
  ON public.travel_group_booking_requests;
CREATE POLICY travel_group_booking_requests_select_member
  ON public.travel_group_booking_requests
  FOR SELECT
  TO authenticated
  USING (
    public.is_application_owner()
    OR EXISTS (
      SELECT 1
      FROM public.church_memberships m
      WHERE m.church_id = travel_group_booking_requests.church_id
        AND m.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.travel_group_booking_requests IS
  'Corporate group travel requests (party_size >= 10). church_id/requester_id are server-stamped only.';
