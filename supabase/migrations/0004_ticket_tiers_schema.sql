-- =============================================================================
-- 0004 — Expand public.orders product_type for multi-tier event tickets
-- =============================================================================
-- Non-destructive: alters CHECK constraint only. No table drops, no row deletes,
-- no attendee or paid-order data is modified.
--
-- Canonical product ids (lib/merch/catalog.ts):
--   Merch     : cd-preorder, concert-tee, choir-hoodie
--   Legacy    : live-pass
--   Seeds     : seed-pack-sower, seed-pack-harvest, seed-pack-golden
--   Tickets   : ticket-tier-basic, ticket-tier-pro, ticket-tier-vip
-- =============================================================================

ALTER TABLE public.orders
  DROP CONSTRAINT IF EXISTS orders_product_type_check;

ALTER TABLE public.orders
  ADD CONSTRAINT orders_product_type_check CHECK (
    product_type IN (
      -- Apparel & music merch
      'cd-preorder',
      'concert-tee',
      'choir-hoodie',
      -- Legacy single-tier live pass (retained for historical rows & dev bypass)
      'live-pass',
      -- Vital Seed economy packs
      'seed-pack-sower',
      'seed-pack-harvest',
      'seed-pack-golden',
      -- Multi-tier digital event tickets
      'ticket-tier-basic',
      'ticket-tier-pro',
      'ticket-tier-vip'
    )
  );

COMMENT ON CONSTRAINT orders_product_type_check ON public.orders IS
  'Allow-list aligned with lib/merch/catalog.ts MERCH_PRODUCTS + EVENT_TICKET_TIERS.';
