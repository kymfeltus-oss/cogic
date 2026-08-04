create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  customer_email text not null,
  product_id text not null,
  selected_size text default 'N/A',
  stripe_session_id text unique,
  status text default 'pending',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table public.orders enable row level security;

create index if not exists orders_stripe_session_id_idx on public.orders (stripe_session_id);
create index if not exists orders_customer_email_idx on public.orders (customer_email);;
