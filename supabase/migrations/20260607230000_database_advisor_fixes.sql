-- =============================================================================
-- 20260607230000_database_advisor_fixes.sql
-- Supabase Advisor: SECURITY INVOKER view + donations RLS public read aggregate
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fix #5 — live_donation_totals evaluates caller rights (not definer bypass)
-- ---------------------------------------------------------------------------
DROP VIEW IF EXISTS public.live_donation_totals;

CREATE VIEW public.live_donation_totals
WITH (security_invoker = true)
AS
SELECT
  COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0)::bigint AS total_cents,
  COUNT(*) FILTER (WHERE status = 'paid')::bigint AS donation_count
FROM public.donations;

ALTER VIEW public.live_donation_totals SET (security_invoker = true);

COMMENT ON VIEW public.live_donation_totals IS
  'Aggregate paid donation totals; SECURITY INVOKER respects donations RLS of caller.';

-- ---------------------------------------------------------------------------
-- Fix #6 — donations RLS with permissive public read for aggregate metrics
-- ---------------------------------------------------------------------------
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS donations_select_own ON public.donations;
DROP POLICY IF EXISTS "Allow public read access to donations" ON public.donations;

CREATE POLICY "Allow public read access to donations"
  ON public.donations
  FOR SELECT
  USING (true);

REVOKE ALL ON public.donations FROM PUBLIC;
GRANT SELECT ON public.donations TO anon, authenticated;
GRANT ALL ON public.donations TO service_role;

GRANT SELECT ON public.live_donation_totals TO anon, authenticated, service_role;
