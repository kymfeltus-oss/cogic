-- COGIC Social completion: posting controls and attendee reporting on the
-- existing, authoritative Fellowship Chat message store.

CREATE TABLE IF NOT EXISTS public.social_settings (
  id text PRIMARY KEY CHECK (id = 'community'),
  posting_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.social_settings (id, posting_enabled)
VALUES ('community', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.chat_message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.chat_messages (id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'safety', 'other')),
  detail text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (message_id, reporter_id)
);

CREATE INDEX IF NOT EXISTS chat_message_reports_status_created_idx
  ON public.chat_message_reports (status, created_at DESC);

ALTER TABLE public.social_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.social_settings FORCE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_message_reports FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.social_settings, public.chat_message_reports FROM PUBLIC, anon;
GRANT SELECT ON public.social_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.chat_message_reports TO authenticated;
GRANT ALL ON public.social_settings, public.chat_message_reports TO service_role;

DROP POLICY IF EXISTS social_settings_attendee_read ON public.social_settings;
CREATE POLICY social_settings_attendee_read
  ON public.social_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS chat_message_reports_attendee_select ON public.chat_message_reports;
CREATE POLICY chat_message_reports_attendee_select
  ON public.chat_message_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

DROP POLICY IF EXISTS chat_message_reports_attendee_insert ON public.chat_message_reports;
CREATE POLICY chat_message_reports_attendee_insert
  ON public.chat_message_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');

DROP POLICY IF EXISTS chat_message_reports_attendee_update ON public.chat_message_reports;
CREATE POLICY chat_message_reports_attendee_update
  ON public.chat_message_reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');

COMMENT ON TABLE public.social_settings IS
  'Owner-managed COGIC Social availability settings.';
COMMENT ON TABLE public.chat_message_reports IS
  'Attendee safety reports for persisted Fellowship Chat / COGIC Social messages.';
