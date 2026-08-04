-- Movement signups from music tab and join-the-movement page.

CREATE TABLE IF NOT EXISTS public.movement_leads (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text        NOT NULL,
  last_name  text        NOT NULL,
  email      text        NOT NULL,
  phone      text        NOT NULL,
  source     text        NOT NULL DEFAULT 'join_movement_page',
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),

  CONSTRAINT movement_leads_email_not_blank CHECK (char_length(trim(email)) > 0),
  CONSTRAINT movement_leads_names_not_blank CHECK (
    char_length(trim(first_name)) > 0 AND char_length(trim(last_name)) > 0
  ),
  CONSTRAINT movement_leads_phone_not_blank CHECK (char_length(trim(phone)) > 0),
  CONSTRAINT movement_leads_email_unique UNIQUE (email)
);

CREATE INDEX movement_leads_created_at_idx
  ON public.movement_leads (created_at DESC);

COMMENT ON TABLE public.movement_leads IS
  'Lead capture for Join the Movement signups (music tab and dedicated form).';

ALTER TABLE public.movement_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.movement_leads FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.movement_leads FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.movement_leads TO service_role;
