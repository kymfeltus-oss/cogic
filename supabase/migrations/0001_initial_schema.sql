-- =============================================================================
-- 300 Awakening — Initial Production Schema
-- Project: cogic (wjlaaluonxiaxmytiqwi); imported from the predecessor project
--
-- Tables : attendees, orders, donations, chat_messages, harvest_progress
-- Auth   : public.handle_new_user() syncs auth.users → public.attendees
-- Access : Row-Level Security (RLS) — authenticated read, service-role writes
-- Realtime: chat_messages, harvest_progress, orders
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerated domain checks (inline CHECK constraints for portability)
-- ---------------------------------------------------------------------------
-- order/donation status : pending | paid | canceled | failed
-- product_type          : cd-preorder | concert-tee | choir-hoodie | live-pass

-- ---------------------------------------------------------------------------
-- Table: public.attendees
-- Mirrors auth.users for application-level attendee registry.
-- Populated automatically by public.handle_new_user() on auth signup.
-- ---------------------------------------------------------------------------
CREATE TABLE public.attendees (
  id         uuid        PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  email      text        NOT NULL,
  is_guest   boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT attendees_email_not_blank CHECK (char_length(trim(email)) > 0),
  CONSTRAINT attendees_email_unique UNIQUE (email)
);

CREATE INDEX attendees_email_idx ON public.attendees (lower(email));

COMMENT ON TABLE public.attendees IS
  'Registered and guest attendees synchronized from auth.users.';
COMMENT ON COLUMN public.attendees.is_guest IS
  'True when auth.users.raw_user_meta_data.is_guest = true (guest session).';

-- ---------------------------------------------------------------------------
-- Table: public.orders
-- Merch + live-pass checkout ledger. Written by API routes / webhooks (service role).
-- ---------------------------------------------------------------------------
CREATE TABLE public.orders (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        REFERENCES auth.users (id) ON DELETE SET NULL,
  email             text        NOT NULL,
  status            text        NOT NULL DEFAULT 'pending',
  amount_total      integer     NOT NULL,
  stripe_session_id text,
  product_type      text        NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT orders_email_not_blank CHECK (char_length(trim(email)) > 0),
  CONSTRAINT orders_amount_total_positive CHECK (amount_total > 0),
  CONSTRAINT orders_status_check CHECK (
    status IN ('pending', 'paid', 'canceled', 'failed')
  ),
  CONSTRAINT orders_product_type_check CHECK (
    product_type IN ('cd-preorder', 'concert-tee', 'choir-hoodie', 'live-pass')
  ),
  CONSTRAINT orders_stripe_session_id_unique UNIQUE (stripe_session_id)
);

CREATE INDEX orders_user_id_idx ON public.orders (user_id);
CREATE INDEX orders_email_idx ON public.orders (lower(email));
CREATE INDEX orders_status_idx ON public.orders (status);
CREATE INDEX orders_email_product_status_idx
  ON public.orders (lower(email), product_type, status);
CREATE INDEX orders_stripe_session_id_idx ON public.orders (stripe_session_id);

COMMENT ON TABLE public.orders IS
  'Stripe checkout ledger for merch and live-pass purchases.';
COMMENT ON COLUMN public.orders.amount_total IS
  'Charge amount in USD cents (matches Stripe unit_amount).';
COMMENT ON COLUMN public.orders.product_type IS
  'Catalog product id from lib/merch/catalog.ts.';

-- ---------------------------------------------------------------------------
-- Table: public.donations
-- Vital Seed giving ledger. Written by API routes / webhooks (service role).
-- ---------------------------------------------------------------------------
CREATE TABLE public.donations (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  email             text        NOT NULL,
  amount_cents      integer     NOT NULL,
  status            text        NOT NULL DEFAULT 'pending',
  stripe_session_id text,
  created_at        timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT donations_email_not_blank CHECK (char_length(trim(email)) > 0),
  CONSTRAINT donations_amount_cents_minimum CHECK (amount_cents >= 50),
  CONSTRAINT donations_status_check CHECK (
    status IN ('pending', 'paid', 'canceled', 'failed')
  ),
  CONSTRAINT donations_stripe_session_id_unique UNIQUE (stripe_session_id)
);

CREATE INDEX donations_email_idx ON public.donations (lower(email));
CREATE INDEX donations_status_idx ON public.donations (status);
CREATE INDEX donations_stripe_session_id_idx ON public.donations (stripe_session_id);

COMMENT ON TABLE public.donations IS
  'Stripe checkout ledger for Vital Seed donations.';
COMMENT ON COLUMN public.donations.amount_cents IS
  'Donation amount in USD cents (minimum 50).';

-- ---------------------------------------------------------------------------
-- Table: public.chat_messages
-- Live room interaction stream. Inserted by POST /api/live/chat (service role).
-- ---------------------------------------------------------------------------
CREATE TABLE public.chat_messages (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  email      text        NOT NULL,
  content    text        NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT chat_messages_email_not_blank CHECK (char_length(trim(email)) > 0),
  CONSTRAINT chat_messages_content_check CHECK (
    char_length(trim(content)) BETWEEN 1 AND 500
  )
);

CREATE INDEX chat_messages_created_at_idx
  ON public.chat_messages (created_at DESC);
CREATE INDEX chat_messages_user_id_idx ON public.chat_messages (user_id);

COMMENT ON TABLE public.chat_messages IS
  'Persisted live-room chat messages broadcast via Supabase Realtime.';

-- ---------------------------------------------------------------------------
-- Table: public.harvest_progress
-- Singleton aggregate of paid order revenue for the Awakening Harvest meter.
-- Maintained by public.refresh_harvest_progress() trigger on public.orders.
-- ---------------------------------------------------------------------------
CREATE TABLE public.harvest_progress (
  id          integer     PRIMARY KEY DEFAULT 1,
  total_cents bigint      NOT NULL DEFAULT 0,
  updated_at  timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT harvest_progress_singleton_check CHECK (id = 1),
  CONSTRAINT harvest_progress_total_non_negative CHECK (total_cents >= 0)
);

INSERT INTO public.harvest_progress (id, total_cents)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.harvest_progress IS
  'Single-row harvest total (sum of orders.amount_total where status = paid).';

-- ---------------------------------------------------------------------------
-- Function: public.handle_new_user()
-- Synchronizes new auth.users rows into public.attendees.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.attendees (id, email, is_guest)
  VALUES (
    NEW.id,
    lower(trim(NEW.email)),
    COALESCE((NEW.raw_user_meta_data ->> 'is_guest')::boolean, false)
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    is_guest = EXCLUDED.is_guest;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.handle_new_user() IS
  'AFTER INSERT trigger on auth.users — provisions public.attendees row.';

-- ---------------------------------------------------------------------------
-- Trigger: auth.users → public.attendees
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Function: public.refresh_harvest_progress()
-- Recomputes harvest_progress.total_cents from paid orders.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.refresh_harvest_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.harvest_progress
  SET
    total_cents = (
      SELECT COALESCE(SUM(amount_total), 0)::bigint
      FROM public.orders
      WHERE status = 'paid'
    ),
    updated_at = timezone('utc', now())
  WHERE id = 1;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION public.refresh_harvest_progress() IS
  'Statement-level trigger on public.orders — keeps harvest_progress in sync.';

-- ---------------------------------------------------------------------------
-- Trigger: public.orders → public.harvest_progress
-- ---------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_orders_refresh_harvest ON public.orders;

CREATE TRIGGER trg_orders_refresh_harvest
  AFTER INSERT OR UPDATE OF status, amount_total ON public.orders
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.refresh_harvest_progress();

-- Seed harvest total from any pre-existing paid orders (idempotent re-run safe).
UPDATE public.harvest_progress
SET
  total_cents = (
    SELECT COALESCE(SUM(amount_total), 0)::bigint
    FROM public.orders
    WHERE status = 'paid'
  ),
  updated_at = timezone('utc', now())
WHERE id = 1;

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- Model:
--   • authenticated (cookie session via Supabase SSR) — scoped SELECT only
--   • service_role (API routes, webhooks, triggers)    — full access (bypasses RLS)
--   • anon                                           — no direct table access
-- Writes never originate from the browser client; all mutations go through
-- server-verified API handlers using SUPABASE_SERVICE_ROLE_KEY.
-- ---------------------------------------------------------------------------

ALTER TABLE public.attendees       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_progress ENABLE ROW LEVEL SECURITY;

-- Force RLS even for table owners (defense in depth).
ALTER TABLE public.attendees        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.orders           FORCE ROW LEVEL SECURITY;
ALTER TABLE public.donations        FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages    FORCE ROW LEVEL SECURITY;
ALTER TABLE public.harvest_progress FORCE ROW LEVEL SECURITY;

-- ---- attendees ------------------------------------------------------------
-- Identity: session user reads only their own attendee profile row.
DROP POLICY IF EXISTS attendees_select_own ON public.attendees;
CREATE POLICY attendees_select_own
  ON public.attendees
  FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- No INSERT / UPDATE / DELETE policies for authenticated or anon.
-- Rows are created by handle_new_user() (SECURITY DEFINER) and service role.

-- ---- orders ---------------------------------------------------------------
-- Identity: session user reads orders tied to their user_id or verified JWT email.
-- Used by client realtime for own checkout settlement; global harvest uses harvest_progress.
DROP POLICY IF EXISTS orders_select_own ON public.orders;
CREATE POLICY orders_select_own
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id
    OR lower(email) = lower(auth.jwt() ->> 'email')
  );

-- No write policies — inserts/updates via /api/checkout/merch and Stripe webhook only.

-- ---- donations ------------------------------------------------------------
-- Identity: session user reads only their own donation history by JWT email.
DROP POLICY IF EXISTS donations_select_own ON public.donations;
CREATE POLICY donations_select_own
  ON public.donations
  FOR SELECT
  TO authenticated
  USING (lower(email) = lower(auth.jwt() ->> 'email'));

-- No write policies — inserts/updates via /api/checkout and Stripe webhook only.

-- ---- chat_messages --------------------------------------------------------
-- Identity: any authenticated dashboard user may read the live-room feed.
-- Required for Supabase Realtime broadcast to all connected viewers.
DROP POLICY IF EXISTS chat_messages_select_authenticated ON public.chat_messages;
CREATE POLICY chat_messages_select_authenticated
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT policy — POST /api/live/chat persists via service role with
-- server-resolved user_id/email (never trusting client-supplied identity).

-- ---- harvest_progress -----------------------------------------------------
-- Identity: any authenticated dashboard user may read the global harvest meter.
-- Required for Supabase Realtime UPDATE broadcast across all viewports.
DROP POLICY IF EXISTS harvest_progress_select_authenticated ON public.harvest_progress;
CREATE POLICY harvest_progress_select_authenticated
  ON public.harvest_progress
  FOR SELECT
  TO authenticated
  USING (true);

-- No write policies — rows updated exclusively by refresh_harvest_progress() trigger.

-- ---------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------
REVOKE ALL ON public.attendees        FROM PUBLIC, anon;
REVOKE ALL ON public.orders           FROM PUBLIC, anon;
REVOKE ALL ON public.donations        FROM PUBLIC, anon;
REVOKE ALL ON public.chat_messages    FROM PUBLIC, anon;
REVOKE ALL ON public.harvest_progress FROM PUBLIC, anon;

GRANT SELECT ON public.attendees        TO authenticated;
GRANT SELECT ON public.orders           TO authenticated;
GRANT SELECT ON public.donations        TO authenticated;
GRANT SELECT ON public.chat_messages    TO authenticated;
GRANT SELECT ON public.harvest_progress TO authenticated;

GRANT ALL ON public.attendees        TO service_role;
GRANT ALL ON public.orders           TO service_role;
GRANT ALL ON public.donations        TO service_role;
GRANT ALL ON public.chat_messages    TO service_role;
GRANT ALL ON public.harvest_progress TO service_role;

-- ---------------------------------------------------------------------------
-- Supabase Realtime publication
-- Enables postgres_changes subscriptions in useLiveRoomChat / useHarvestMetrics.
-- ---------------------------------------------------------------------------
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.harvest_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
