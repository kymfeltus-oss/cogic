-- Slice 1: configurable registration products and access entitlements.
-- No production products or entitlements are seeded by this migration.

CREATE TABLE IF NOT EXISTS public.registration_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  product_key text NOT NULL,
  name text NOT NULL,
  description text NULL,
  eligibility_description text NULL,
  price_cents integer NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
  currency text NOT NULL DEFAULT 'usd' CHECK (char_length(trim(currency)) = 3),
  registration_opens_at timestamptz NULL,
  registration_closes_at timestamptz NULL,
  capacity integer NULL CHECK (capacity IS NULL OR capacity >= 0),
  badge_type text NULL,
  active boolean NOT NULL DEFAULT true,
  public boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT registration_products_key_format CHECK (product_key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  CONSTRAINT registration_products_window CHECK (registration_closes_at IS NULL OR registration_opens_at IS NULL OR registration_closes_at > registration_opens_at),
  UNIQUE (program_key, product_key)
);

CREATE TABLE IF NOT EXISTS public.access_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  entitlement_key text NOT NULL,
  name text NOT NULL,
  description text NULL,
  entitlement_type text NOT NULL CHECK (entitlement_type IN ('event_access','seating','housing','content','item','badge','discount')),
  active boolean NOT NULL DEFAULT true,
  event_type text NULL,
  event_id uuid NULL REFERENCES public.events(id) ON DELETE CASCADE,
  event_occurrence_id uuid NULL REFERENCES public.event_occurrences(id) ON DELETE CASCADE,
  venue_key text NULL,
  access_zone text NULL,
  valid_from timestamptz NULL,
  valid_until timestamptz NULL,
  preferred_hold_minutes integer NULL CHECK (preferred_hold_minutes IS NULL OR preferred_hold_minutes >= 0),
  default_quantity integer NOT NULL DEFAULT 1 CHECK (default_quantity > 0),
  usage_limit integer NULL CHECK (usage_limit IS NULL OR usage_limit > 0),
  single_use boolean NOT NULL DEFAULT false,
  guardian_required boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT access_entitlements_key_format CHECK (entitlement_key ~ '^[A-Z][A-Z0-9_]{1,63}$'),
  CONSTRAINT access_entitlements_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from),
  UNIQUE (program_key, entitlement_key)
);

CREATE TABLE IF NOT EXISTS public.registration_product_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_product_id uuid NOT NULL REFERENCES public.registration_products(id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL REFERENCES public.access_entitlements(id) ON DELETE CASCADE,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  active boolean NOT NULL DEFAULT true,
  rule_config jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(rule_config) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (registration_product_id, entitlement_id)
);

CREATE TABLE IF NOT EXISTS public.attendee_entitlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_key text NOT NULL DEFAULT 'cogic-stream-2026',
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  registration_id uuid NULL REFERENCES public.registrations(id) ON DELETE CASCADE,
  entitlement_id uuid NOT NULL REFERENCES public.access_entitlements(id) ON DELETE RESTRICT,
  source_product_entitlement_id uuid NULL REFERENCES public.registration_product_entitlements(id) ON DELETE SET NULL,
  guardian_registration_id uuid NULL REFERENCES public.registrations(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('pending','active','consumed','expired','revoked')),
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  uses_consumed integer NOT NULL DEFAULT 0 CHECK (uses_consumed >= 0),
  valid_from timestamptz NULL,
  valid_until timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT attendee_entitlements_validity CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until > valid_from),
  UNIQUE (registration_id, entitlement_id)
);

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS registration_product_id uuid NULL REFERENCES public.registration_products(id) ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS registration_products_public_idx ON public.registration_products(program_key, public, active, sort_order);
CREATE INDEX IF NOT EXISTS access_entitlements_scope_idx ON public.access_entitlements(program_key, event_occurrence_id, event_id, event_type, active);
CREATE INDEX IF NOT EXISTS attendee_entitlements_user_idx ON public.attendee_entitlements(program_key, user_id, status);
CREATE INDEX IF NOT EXISTS attendee_entitlements_registration_idx ON public.attendee_entitlements(registration_id, status);

DROP TRIGGER IF EXISTS registration_products_set_updated_at ON public.registration_products;
CREATE TRIGGER registration_products_set_updated_at BEFORE UPDATE ON public.registration_products FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
DROP TRIGGER IF EXISTS access_entitlements_set_updated_at ON public.access_entitlements;
CREATE TRIGGER access_entitlements_set_updated_at BEFORE UPDATE ON public.access_entitlements FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
DROP TRIGGER IF EXISTS registration_product_entitlements_set_updated_at ON public.registration_product_entitlements;
CREATE TRIGGER registration_product_entitlements_set_updated_at BEFORE UPDATE ON public.registration_product_entitlements FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();
DROP TRIGGER IF EXISTS attendee_entitlements_set_updated_at ON public.attendee_entitlements;
CREATE TRIGGER attendee_entitlements_set_updated_at BEFORE UPDATE ON public.attendee_entitlements FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.registration_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_products FORCE ROW LEVEL SECURITY;
ALTER TABLE public.access_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.access_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.registration_product_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_product_entitlements FORCE ROW LEVEL SECURITY;
ALTER TABLE public.attendee_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendee_entitlements FORCE ROW LEVEL SECURITY;

REVOKE ALL ON public.registration_products, public.access_entitlements, public.registration_product_entitlements, public.attendee_entitlements FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.registration_products, public.access_entitlements, public.registration_product_entitlements, public.attendee_entitlements TO service_role;

COMMENT ON TABLE public.registration_products IS 'Admin-configured registration products; names never authorize access directly.';
COMMENT ON TABLE public.access_entitlements IS 'Stable, controlled access capabilities and their event/time/zone scope.';
COMMENT ON TABLE public.registration_product_entitlements IS 'Normalized product-to-entitlement configuration.';
COMMENT ON TABLE public.attendee_entitlements IS 'Persisted capabilities granted after authoritative fulfillment.';
