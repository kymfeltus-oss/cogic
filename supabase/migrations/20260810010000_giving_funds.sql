-- =============================================================================
-- Giving funds — owner-managed designations for COGIC Giving checkout
-- Additive only. LIVE MODE ONLY — seeds real operational fund keys, not demo data.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.giving_funds (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fund_key      text        NOT NULL,
  label         text        NOT NULL,
  description   text        NULL,
  active        boolean     NOT NULL DEFAULT true,
  published     boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  updated_at    timestamptz NOT NULL DEFAULT timezone('utc', now()),
  created_by    uuid        NULL,
  updated_by    uuid        NULL,

  CONSTRAINT giving_funds_key_format
    CHECK (fund_key ~ '^[a-z][a-z0-9_]{1,47}$'),
  CONSTRAINT giving_funds_label_not_blank
    CHECK (char_length(trim(label)) > 0),
  CONSTRAINT giving_funds_key_unique
    UNIQUE (fund_key)
);

COMMENT ON TABLE public.giving_funds IS
  'Authoritative COGIC Giving fund designations managed by owners; attendee checkout reads active+published rows.';

CREATE INDEX IF NOT EXISTS giving_funds_active_published_sort_idx
  ON public.giving_funds (active, published, sort_order, label);

ALTER TABLE public.giving_funds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.giving_funds FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.giving_funds FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.giving_funds TO anon, authenticated;
GRANT ALL ON public.giving_funds TO service_role;

DROP POLICY IF EXISTS giving_funds_public_select ON public.giving_funds;
CREATE POLICY giving_funds_public_select
  ON public.giving_funds
  FOR SELECT
  TO anon, authenticated
  USING (active = true AND published = true);

INSERT INTO public.giving_funds (fund_key, label, description, active, published, sort_order)
VALUES
  ('tithes', 'Tithes', 'Tithes', true, true, 1),
  ('offering', 'Offering', 'Offering', true, true, 2),
  ('missions', 'Missions', 'Missions', true, true, 3),
  ('general_fund', 'General Fund', 'General Fund', true, true, 4)
ON CONFLICT (fund_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
