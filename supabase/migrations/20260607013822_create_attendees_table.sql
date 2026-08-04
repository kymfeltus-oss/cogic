create table if not exists public.attendees (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.attendees enable row level security;

create policy "Allow anonymous insert for email gate"
  on public.attendees
  for insert
  to anon
  with check (true);

create policy "Allow anonymous select own email"
  on public.attendees
  for select
  to anon
  using (true);
;
