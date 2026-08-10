DROP POLICY IF EXISTS giving_funds_public_select ON public.giving_funds;
DROP TABLE IF EXISTS public.giving_funds;
NOTIFY pgrst, 'reload schema';
