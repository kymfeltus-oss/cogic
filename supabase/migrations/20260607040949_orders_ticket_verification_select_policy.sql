create policy "Allow live pass ticket verification reads"
  on public.orders
  for select
  to anon
  using (product_id = 'live-pass');;
