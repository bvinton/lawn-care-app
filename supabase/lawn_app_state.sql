-- Run once in Supabase SQL Editor (Lawn app + same project as Tasks app).
-- Single-row store for lawn pack progress (Weedol, steps, mow/water dates, etc.).

create table if not exists public.lawn_app_state (
  id text primary key default 'default',
  user_logs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.lawn_app_state enable row level security;

create policy "Allow read lawn_app_state"
  on public.lawn_app_state
  for select
  to anon, authenticated
  using (true);

create policy "Allow insert lawn_app_state"
  on public.lawn_app_state
  for insert
  to anon, authenticated
  with check (true);

create policy "Allow update lawn_app_state"
  on public.lawn_app_state
  for update
  to anon, authenticated
  using (true)
  with check (true);

insert into public.lawn_app_state (id, user_logs)
values ('default', '{}'::jsonb)
on conflict (id) do nothing;
