-- Run once in Supabase SQL Editor (same project as Tasks app).
-- Lets the Tasks app recompute lawn schedules without opening the Lawn app.

alter table public.lawn_app_state
  add column if not exists schedule_snapshot jsonb not null default '{}'::jsonb;
