-- UI upgrade: dashboard stats (animated counters) + realtime for live updates
create or replace function public.dashboard_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'events',        (select count(*) from public.events),
    'open_events',   (select count(*) from public.events where status = 'open'),
    'attendance',    (select count(*) from public.attendance a
                       where public.my_role() = 'admin'
                          or exists (select 1 from public.events e where e.id = a.event_id and e.created_by = auth.uid())),
    'my_attendance', (select count(*) from public.attendance where student_id = auth.uid()));
$$;
revoke all on function public.dashboard_stats() from public, anon;
grant execute on function public.dashboard_stats() to authenticated;

-- full row data on realtime deletes; live event status for students
alter table public.attendance replica identity full;
alter table public.events replica identity full;
do $$ begin alter publication supabase_realtime add table public.events;
exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.attendance;
exception when duplicate_object then null; end $$;
