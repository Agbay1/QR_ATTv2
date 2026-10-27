-- QR-ATT schema: profiles, events, attendance + RLS + secure attendance RPC
create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(trim(full_name)) > 0),
  student_no text,
  role text not null default 'student' check (role in ('student','teacher','admin')),
  created_at timestamptz not null default now()
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) > 0),
  event_date date not null,
  event_time time not null,
  venue text not null,
  description text,
  status text not null default 'open' check (status in ('open','closed')),
  qr_token uuid not null unique default gen_random_uuid(),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'present' check (status in ('present','late','excused')),
  scanned_at timestamptz not null default now(),
  unique (event_id, student_id)           -- duplicate attendance prevention
);
create index on public.attendance (student_id);
create index on public.events (created_by);

-- Helper: current user's role (security definer avoids RLS recursion)
create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as
$$ select role from public.profiles where id = auth.uid() $$;

-- New auth user -> profile. Role is ALWAYS 'student'; admins promote users.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, student_no)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email,'@',1)),
          nullif(trim(new.raw_user_meta_data->>'student_no'), ''));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Secure QR attendance: validates QR, event status, role, duplicates
create or replace function public.record_attendance(p_token text) returns text
language plpgsql security definer set search_path = public as $$
declare ev public.events%rowtype;
begin
  if auth.uid() is null or public.my_role() <> 'student' then raise exception 'UNAUTHORIZED'; end if;
  select * into ev from public.events where qr_token::text = lower(trim(p_token));
  if not found then raise exception 'INVALID_QR'; end if;
  if ev.status <> 'open' then raise exception 'EVENT_CLOSED'; end if;
  begin
    insert into public.attendance (event_id, student_id) values (ev.id, auth.uid());
  exception when unique_violation then raise exception 'DUPLICATE'; end;
  return ev.name;
end $$;
revoke all on function public.record_attendance(text) from public, anon;
grant execute on function public.record_attendance(text) to authenticated;
revoke all on function public.my_role() from public, anon;
grant execute on function public.my_role() to authenticated;

-- RLS
alter table public.profiles   enable row level security;
alter table public.events     enable row level security;
alter table public.attendance enable row level security;

-- profiles
create policy "profiles read own or staff" on public.profiles for select to authenticated
  using (id = auth.uid() or public.my_role() in ('teacher','admin'));
create policy "profiles update own (no role change)" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = public.my_role());
create policy "profiles admin all" on public.profiles for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- events
create policy "events read" on public.events for select to authenticated using (true);
create policy "events teacher insert" on public.events for insert to authenticated
  with check (public.my_role() in ('teacher','admin') and created_by = auth.uid());
create policy "events teacher update own" on public.events for update to authenticated
  using (public.my_role() = 'teacher' and created_by = auth.uid())
  with check (public.my_role() = 'teacher' and created_by = auth.uid());
create policy "events admin all" on public.events for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- attendance (students cannot insert directly; only via record_attendance)
create policy "attendance student own" on public.attendance for select to authenticated
  using (student_id = auth.uid());
create policy "attendance teacher own events" on public.attendance for select to authenticated
  using (public.my_role() = 'teacher' and exists
        (select 1 from public.events e where e.id = event_id and e.created_by = auth.uid()));
create policy "attendance admin all" on public.attendance for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Realtime for attendance
alter publication supabase_realtime add table public.attendance;

-- AFTER registering your first account, make it admin (run in SQL editor):
-- update public.profiles set role = 'admin'
--   where id = (select id from auth.users where email = 'YOUR_EMAIL');
