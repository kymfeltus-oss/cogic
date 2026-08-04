-- Seed billing tiers (100 / 300 / 600 / 1200) for Stripe Price ID checkout.

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_product_type_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_product_type_check CHECK (
  product_type IN (
    'cd-preorder',
    'concert-tee',
    'choir-hoodie',
    'live-pass',
    'seed-pack-sower',
    'seed-pack-harvest',
    'seed-pack-golden',
    'seed-pack-100',
    'seed-pack-300',
    'seed-pack-600',
    'seed-pack-1200',
    'ticket-tier-basic',
    'ticket-tier-pro',
    'ticket-tier-vip'
  )
);

CREATE OR REPLACE FUNCTION public.resolve_seed_pack_credit(p_product_id text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_product_id
    WHEN 'seed-pack-sower' THEN 100
    WHEN 'seed-pack-harvest' THEN 350
    WHEN 'seed-pack-golden' THEN 800
    WHEN 'seed-pack-100' THEN 100
    WHEN 'seed-pack-300' THEN 300
    WHEN 'seed-pack-600' THEN 600
    WHEN 'seed-pack-1200' THEN 1200
    ELSE 0
  END;
$$;
