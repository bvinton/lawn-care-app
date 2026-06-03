-- Run once in Supabase SQL Editor (same project as Tasks app).
-- Stores the latest Open-Meteo forecast so the Tasks app can refresh lawn schedules.

alter table public.lawn_app_state
  add column if not exists weather_snapshot jsonb not null default '{}'::jsonb;
