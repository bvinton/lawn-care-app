-- Optional: run in Supabase SQL Editor so Tasks app can store completion timestamps.
alter table public.tasks
  add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_tasks_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tasks_set_updated_at on public.tasks;
create trigger tasks_set_updated_at
  before update on public.tasks
  for each row
  execute function public.set_tasks_updated_at();
