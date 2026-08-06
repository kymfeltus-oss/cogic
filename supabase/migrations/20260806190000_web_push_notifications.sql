-- Web Push subscriptions, preferences, and delivery logging.
-- LIVE MODE ONLY — no seed devices or demo deliveries.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  master_enabled boolean NOT NULL DEFAULT true,
  live_broadcasts boolean NOT NULL DEFAULT true,
  announcements boolean NOT NULL DEFAULT true,
  important_alerts boolean NOT NULL DEFAULT true,
  schedule_reminders boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'web_push'
    CHECK (channel IN ('web_push')),
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text NULL,
  label text NULL,
  enabled boolean NOT NULL DEFAULT true,
  revoked_at timestamptz NULL,
  last_seen_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT push_subscriptions_endpoint_unique UNIQUE (endpoint),
  CONSTRAINT push_subscriptions_endpoint_not_blank CHECK (char_length(btrim(endpoint)) > 0),
  CONSTRAINT push_subscriptions_keys_not_blank CHECK (
    char_length(btrim(p256dh)) > 0 AND char_length(btrim(auth)) > 0
  )
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_enabled_idx
  ON public.push_subscriptions (user_id, enabled)
  WHERE enabled = true AND revoked_at IS NULL;

CREATE TABLE IF NOT EXISTS public.notification_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key text NOT NULL,
  idempotency_key text NOT NULL,
  kind text NOT NULL
    CHECK (kind IN ('announcement', 'live_start', 'schedule_reminder')),
  announcement_id uuid NULL REFERENCES public.announcements (id) ON DELETE SET NULL,
  subscription_id uuid NULL REFERENCES public.push_subscriptions (id) ON DELETE SET NULL,
  user_id uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'processing', 'sent', 'failed', 'expired')),
  title text NOT NULL,
  body text NOT NULL,
  deep_link text NOT NULL,
  provider_status_code integer NULL,
  error_message text NULL,
  created_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  sent_at timestamptz NULL,
  CONSTRAINT notification_deliveries_idempotency_unique UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS notification_deliveries_campaign_idx
  ON public.notification_deliveries (campaign_key, status);

CREATE INDEX IF NOT EXISTS notification_deliveries_announcement_idx
  ON public.notification_deliveries (announcement_id);

-- Dedup ledger for automatic LIVE-start campaigns (at most one open session).
CREATE TABLE IF NOT EXISTS public.live_push_sessions (
  session_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_key text NOT NULL UNIQUE,
  triggered_by uuid NULL REFERENCES auth.users (id) ON DELETE SET NULL,
  title text NULL,
  ended_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

-- Prevents spam: only one open LIVE-start campaign may exist at a time.
CREATE UNIQUE INDEX IF NOT EXISTS live_push_sessions_one_open_idx
  ON public.live_push_sessions ((true))
  WHERE ended_at IS NULL;

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.live_push_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS notification_preferences_own_select ON public.notification_preferences;
CREATE POLICY notification_preferences_own_select
  ON public.notification_preferences FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_preferences_own_upsert ON public.notification_preferences;
CREATE POLICY notification_preferences_own_insert
  ON public.notification_preferences FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS notification_preferences_own_update ON public.notification_preferences;
CREATE POLICY notification_preferences_own_update
  ON public.notification_preferences FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_own_select ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_select
  ON public.push_subscriptions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_own_insert ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_insert
  ON public.push_subscriptions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_own_update ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_update
  ON public.push_subscriptions FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS push_subscriptions_own_delete ON public.push_subscriptions;
CREATE POLICY push_subscriptions_own_delete
  ON public.push_subscriptions FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- Deliveries and live sessions are service-role managed (mass send).
REVOKE ALL ON public.notification_preferences FROM PUBLIC;
REVOKE ALL ON public.push_subscriptions FROM PUBLIC;
REVOKE ALL ON public.notification_deliveries FROM PUBLIC;
REVOKE ALL ON public.live_push_sessions FROM PUBLIC;

GRANT SELECT, INSERT, UPDATE ON public.notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.notification_preferences TO service_role;
GRANT ALL ON public.push_subscriptions TO service_role;
GRANT ALL ON public.notification_deliveries TO service_role;
GRANT ALL ON public.live_push_sessions TO service_role;
