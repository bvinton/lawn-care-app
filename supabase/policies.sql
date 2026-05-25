-- Optional: run in Supabase SQL Editor if deleteLawnTask helpers are needed.
create policy "Allow delete access to tasks"
  on public.tasks
  for delete
  to anon, authenticated
  using (true);
