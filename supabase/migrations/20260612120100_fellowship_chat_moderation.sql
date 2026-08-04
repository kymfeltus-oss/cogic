-- Fellowship Chat moderation extensions (uses existing public.chat_messages)

ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at timestamptz,
  ADD COLUMN IF NOT EXISTS pinned_by uuid REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS chat_messages_active_created_at_idx
  ON public.chat_messages (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS chat_messages_pinned_idx
  ON public.chat_messages (is_pinned)
  WHERE is_pinned = true AND deleted_at IS NULL;

-- Active chat mutes (moderator enforced)
CREATE TABLE IF NOT EXISTS public.chat_room_mutes (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  muted_until timestamptz NOT NULL,
  muted_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS chat_room_mutes_until_idx
  ON public.chat_room_mutes (muted_until DESC);

ALTER TABLE public.chat_room_mutes ENABLE ROW LEVEL SECURITY;

-- Users may read their own mute status; writes via service role only.
DROP POLICY IF EXISTS chat_room_mutes_select_self ON public.chat_room_mutes;
CREATE POLICY chat_room_mutes_select_self
  ON public.chat_room_mutes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Attendees may read non-deleted chat (enables Fellowship Chat viewing + Realtime for anon).
DROP POLICY IF EXISTS chat_messages_select_anon ON public.chat_messages;
CREATE POLICY chat_messages_select_anon
  ON public.chat_messages
  FOR SELECT
  TO anon
  USING (deleted_at IS NULL);

GRANT SELECT ON public.chat_messages TO anon;
GRANT SELECT ON public.chat_room_mutes TO authenticated;
GRANT ALL ON public.chat_room_mutes TO service_role;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_room_mutes;

COMMENT ON TABLE public.chat_room_mutes IS
  'Moderator mutes for Fellowship Chat — enforced by /api/experience/fellowship-chat.';
