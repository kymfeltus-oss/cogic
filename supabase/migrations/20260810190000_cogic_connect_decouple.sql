-- COGIC Connect decouple: public community feed + DMs separate from Live Chat.
-- Live Chat remains on public.chat_messages.
-- Connect is for any authenticated app user (auth.users), not registration-gated.

-- ---------------------------------------------------------------------------
-- 1) Public community posts
-- ---------------------------------------------------------------------------
CREATE TABLE public.connect_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  body text NOT NULL,
  like_count integer NOT NULL DEFAULT 0 CHECK (like_count >= 0),
  amen_count integer NOT NULL DEFAULT 0 CHECK (amen_count >= 0),
  media_count integer NOT NULL DEFAULT 0 CHECK (media_count >= 0 AND media_count <= 4),
  is_pinned boolean NOT NULL DEFAULT false,
  pinned_at timestamptz,
  pinned_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  deleted_at timestamptz,
  deleted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT connect_posts_body_len CHECK (
    char_length(trim(body)) BETWEEN 1 AND 200
  ),
  CONSTRAINT connect_posts_pin_consistency CHECK (
    (is_pinned = false AND pinned_at IS NULL AND pinned_by IS NULL)
    OR (is_pinned = true AND pinned_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX connect_posts_one_pinned_idx
  ON public.connect_posts ((true))
  WHERE is_pinned = true AND deleted_at IS NULL;

CREATE INDEX connect_posts_active_created_idx
  ON public.connect_posts (created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX connect_posts_author_created_idx
  ON public.connect_posts (author_id, created_at DESC);

COMMENT ON TABLE public.connect_posts IS
  'COGIC Connect public community feed posts. Separate from live chat_messages.';

-- ---------------------------------------------------------------------------
-- 2) Post media (photos/videos) — URLs only after server upload to storage
-- ---------------------------------------------------------------------------
CREATE TABLE public.connect_post_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.connect_posts (id) ON DELETE CASCADE,
  media_type text NOT NULL CHECK (media_type IN ('image', 'video')),
  storage_path text NOT NULL,
  public_url text NOT NULL,
  mime_type text NOT NULL,
  byte_size integer NOT NULL CHECK (byte_size > 0 AND byte_size <= 52428800),
  width_px integer CHECK (width_px IS NULL OR width_px > 0),
  height_px integer CHECK (height_px IS NULL OR height_px > 0),
  sort_order integer NOT NULL DEFAULT 0 CHECK (sort_order >= 0 AND sort_order < 4),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT connect_post_media_url_https CHECK (public_url ~* '^https://'),
  CONSTRAINT connect_post_media_path_not_blank CHECK (char_length(trim(storage_path)) > 0),
  UNIQUE (post_id, sort_order)
);

CREATE INDEX connect_post_media_post_idx
  ON public.connect_post_media (post_id, sort_order);

CREATE OR REPLACE FUNCTION public.connect_posts_sync_media_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
  cnt integer;
BEGIN
  target := COALESCE(NEW.post_id, OLD.post_id);
  SELECT count(*)::integer INTO cnt
  FROM public.connect_post_media
  WHERE post_id = target;

  IF cnt > 4 THEN
    RAISE EXCEPTION 'connect_posts allow at most 4 media items';
  END IF;

  UPDATE public.connect_posts
  SET media_count = cnt,
      updated_at = timezone('utc', now())
  WHERE id = target;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS connect_post_media_sync_count ON public.connect_post_media;
CREATE TRIGGER connect_post_media_sync_count
  AFTER INSERT OR UPDATE OR DELETE ON public.connect_post_media
  FOR EACH ROW
  EXECUTE FUNCTION public.connect_posts_sync_media_count();

-- ---------------------------------------------------------------------------
-- 3) Like / Amen reactions + counter maintenance
-- ---------------------------------------------------------------------------
CREATE TABLE public.connect_post_reactions (
  post_id uuid NOT NULL REFERENCES public.connect_posts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reaction text NOT NULL CHECK (reaction IN ('like', 'amen')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (post_id, user_id, reaction)
);

CREATE INDEX connect_post_reactions_user_idx
  ON public.connect_post_reactions (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.connect_posts_sync_reaction_counts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target uuid;
BEGIN
  target := COALESCE(NEW.post_id, OLD.post_id);
  UPDATE public.connect_posts p
  SET
    like_count = (
      SELECT count(*)::integer FROM public.connect_post_reactions r
      WHERE r.post_id = target AND r.reaction = 'like'
    ),
    amen_count = (
      SELECT count(*)::integer FROM public.connect_post_reactions r
      WHERE r.post_id = target AND r.reaction = 'amen'
    ),
    updated_at = timezone('utc', now())
  WHERE p.id = target;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS connect_post_reactions_sync_counts ON public.connect_post_reactions;
CREATE TRIGGER connect_post_reactions_sync_counts
  AFTER INSERT OR DELETE ON public.connect_post_reactions
  FOR EACH ROW
  EXECUTE FUNCTION public.connect_posts_sync_reaction_counts();

-- ---------------------------------------------------------------------------
-- 4) Connect-specific mutes (separate from Live Chat chat_room_mutes)
-- ---------------------------------------------------------------------------
CREATE TABLE public.connect_user_mutes (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  muted_until timestamptz NOT NULL,
  muted_by uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX connect_user_mutes_until_idx
  ON public.connect_user_mutes (muted_until DESC);

COMMENT ON TABLE public.connect_user_mutes IS
  'Owner-enforced mutes for COGIC Connect (not Live Chat).';

-- ---------------------------------------------------------------------------
-- 5) Reports against Connect posts
-- ---------------------------------------------------------------------------
CREATE TABLE public.connect_post_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES public.connect_posts (id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'safety', 'other')),
  detail text CHECK (detail IS NULL OR char_length(detail) <= 500),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  reviewed_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (post_id, reporter_id)
);

CREATE INDEX connect_post_reports_status_created_idx
  ON public.connect_post_reports (status, created_at DESC);

COMMENT ON TABLE public.connect_post_reports IS
  'Attendee safety reports for COGIC Connect posts.';

-- ---------------------------------------------------------------------------
-- 6) Direct messages
-- ---------------------------------------------------------------------------
CREATE TABLE public.direct_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  recipient_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  message_body text NOT NULL,
  media_urls text[] NOT NULL DEFAULT '{}'::text[],
  read_at timestamptz,
  deleted_by_sender_at timestamptz,
  deleted_by_recipient_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT direct_messages_not_self CHECK (sender_id <> recipient_id),
  CONSTRAINT direct_messages_body_len CHECK (
    char_length(trim(message_body)) BETWEEN 1 AND 200
  ),
  CONSTRAINT direct_messages_media_limit CHECK (
    coalesce(array_length(media_urls, 1), 0) <= 4
  )
);

-- Postgres disallows subqueries in CHECK; enforce HTTPS media URLs via trigger.
CREATE OR REPLACE FUNCTION public.direct_messages_validate_media_urls()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM unnest(COALESCE(NEW.media_urls, '{}'::text[])) AS u
    WHERE u IS NULL OR u !~* '^https://'
  ) THEN
    RAISE EXCEPTION 'direct_messages.media_urls must be HTTPS URLs';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS direct_messages_validate_media_urls ON public.direct_messages;
CREATE TRIGGER direct_messages_validate_media_urls
  BEFORE INSERT OR UPDATE OF media_urls ON public.direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.direct_messages_validate_media_urls();

CREATE INDEX direct_messages_recipient_created_idx
  ON public.direct_messages (recipient_id, created_at DESC)
  WHERE deleted_by_recipient_at IS NULL;

CREATE INDEX direct_messages_sender_created_idx
  ON public.direct_messages (sender_id, created_at DESC)
  WHERE deleted_by_sender_at IS NULL;

CREATE INDEX direct_messages_pair_created_idx
  ON public.direct_messages (
    least(sender_id, recipient_id),
    greatest(sender_id, recipient_id),
    created_at DESC
  );

CREATE INDEX direct_messages_unread_idx
  ON public.direct_messages (recipient_id, created_at DESC)
  WHERE read_at IS NULL AND deleted_by_recipient_at IS NULL;

COMMENT ON TABLE public.direct_messages IS
  'COGIC Connect direct messages between authenticated app users.';

CREATE OR REPLACE VIEW public.direct_messages_with_status AS
SELECT
  id,
  sender_id,
  recipient_id,
  message_body,
  media_urls,
  CASE WHEN read_at IS NULL THEN 'unread' ELSE 'read' END AS read_status,
  read_at,
  created_at,
  updated_at
FROM public.direct_messages;

-- ---------------------------------------------------------------------------
-- 7) Keep social_settings as Connect pause switch
-- ---------------------------------------------------------------------------
INSERT INTO public.social_settings (id, posting_enabled)
VALUES ('community', true)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.social_settings IS
  'Owner-managed COGIC Connect posting availability (id=community).';

-- ---------------------------------------------------------------------------
-- 8) Storage bucket for Connect media
-- ---------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'connect-media',
  'connect-media',
  true,
  52428800,
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/quicktime',
    'video/webm'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- 9) RLS
-- ---------------------------------------------------------------------------
ALTER TABLE public.connect_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_posts FORCE ROW LEVEL SECURITY;
ALTER TABLE public.connect_post_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_post_media FORCE ROW LEVEL SECURITY;
ALTER TABLE public.connect_post_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_post_reactions FORCE ROW LEVEL SECURITY;
ALTER TABLE public.connect_user_mutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_user_mutes FORCE ROW LEVEL SECURITY;
ALTER TABLE public.connect_post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.connect_post_reports FORCE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages FORCE ROW LEVEL SECURITY;

REVOKE ALL ON
  public.connect_posts,
  public.connect_post_media,
  public.connect_post_reactions,
  public.connect_user_mutes,
  public.connect_post_reports,
  public.direct_messages
FROM PUBLIC, anon;

GRANT SELECT ON public.connect_posts, public.connect_post_media TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.connect_post_reactions TO authenticated;
GRANT SELECT ON public.connect_user_mutes TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.connect_post_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.direct_messages TO authenticated;
GRANT SELECT ON public.direct_messages_with_status TO authenticated;
GRANT ALL ON
  public.connect_posts,
  public.connect_post_media,
  public.connect_post_reactions,
  public.connect_user_mutes,
  public.connect_post_reports,
  public.direct_messages
TO service_role;

-- Posts/media inserts go through service-role APIs (same pattern as fellowship-chat today).
CREATE POLICY connect_posts_select_active
  ON public.connect_posts
  FOR SELECT
  TO authenticated
  USING (deleted_at IS NULL);

CREATE POLICY connect_post_media_select_active
  ON public.connect_post_media
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.connect_posts p
      WHERE p.id = connect_post_media.post_id
        AND p.deleted_at IS NULL
    )
  );

CREATE POLICY connect_post_reactions_select
  ON public.connect_post_reactions
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY connect_post_reactions_insert_own
  ON public.connect_post_reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY connect_post_reactions_delete_own
  ON public.connect_post_reactions
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY connect_user_mutes_select_self
  ON public.connect_user_mutes
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY connect_post_reports_select_own
  ON public.connect_post_reports
  FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY connect_post_reports_insert_own
  ON public.connect_post_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');

CREATE POLICY connect_post_reports_update_own_open
  ON public.connect_post_reports
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id AND status = 'open');

CREATE POLICY direct_messages_select_participants
  ON public.direct_messages
  FOR SELECT
  TO authenticated
  USING (
    (auth.uid() = sender_id AND deleted_by_sender_at IS NULL)
    OR (auth.uid() = recipient_id AND deleted_by_recipient_at IS NULL)
  );

CREATE POLICY direct_messages_insert_sender
  ON public.direct_messages
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id);

CREATE POLICY direct_messages_update_participants
  ON public.direct_messages
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = sender_id OR auth.uid() = recipient_id);

DROP POLICY IF EXISTS connect_media_public_read ON storage.objects;
CREATE POLICY connect_media_public_read
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'connect-media');

DROP POLICY IF EXISTS connect_media_authenticated_insert_own ON storage.objects;
CREATE POLICY connect_media_authenticated_insert_own
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'connect-media'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS connect_media_service_all ON storage.objects;
CREATE POLICY connect_media_service_all
  ON storage.objects
  FOR ALL
  TO service_role
  USING (bucket_id = 'connect-media')
  WITH CHECK (bucket_id = 'connect-media');

-- Realtime for Connect feed + DMs (ignore if already members)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connect_posts;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.connect_post_reactions;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
