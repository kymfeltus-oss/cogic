create table if not exists public.donations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  amount_cents integer not null check (amount_cents >= 50),
  status text not null default 'pending' check (status in ('pending', 'paid', 'canceled', 'failed')),
  stripe_session_id text unique,
  created_at timestamptz not null default now()
);

alter table public.donations enable row level security;

create index if not exists donations_stripe_session_id_idx on public.donations (stripe_session_id);
create index if not exists donations_email_idx on public.donations (email);;
