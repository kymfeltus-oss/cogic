create policy "Allow live pass dev bypass insert"
  on public.orders
  for insert
  to anon
  with check (product_id = 'live-pass' and status = 'paid');;
