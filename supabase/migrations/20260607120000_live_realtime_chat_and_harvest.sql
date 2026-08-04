-- Live room chat persistence
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  content text NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 500),
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS chat_messages_created_at_idx
  ON public.chat_messages (created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read chat messages"
  ON public.chat_messages
  FOR SELECT
  TO authenticated
  USING (true);

-- Harvest progress singleton (aggregated from paid orders)
CREATE TABLE IF NOT EXISTS public.harvest_progress (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  total_cents bigint NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

INSERT INTO public.harvest_progress (id, total_cents)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.harvest_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read harvest progress"
  ON public.harvest_progress
  FOR SELECT
  TO authenticated
  USING (true);

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

CREATE TRIGGER trg_orders_refresh_harvest
AFTER INSERT OR UPDATE OF status, amount_total ON public.orders
FOR EACH STATEMENT
EXECUTE FUNCTION public.refresh_harvest_progress();

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.harvest_progress;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
