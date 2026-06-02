-- Run once in Supabase SQL Editor (shared by Lawn app + Tasks app).
-- Stores when a maintenance task was last DONE (separate from next due_date).

alter table public.tasks
  add column if not exists last_completed_date date;

comment on column public.tasks.last_completed_date is
  'Date the task was last completed (mow/water/etc). Set by Tasks app or Lawn app. due_date = next reminder.';
