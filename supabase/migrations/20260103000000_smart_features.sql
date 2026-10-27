-- Smart features: rotating QR, late detection, offline sync support, analytics.
-- Run AFTER migrations 1 and 2.

-- 1. QR secrets live in a private table (students can never read them)
create table public.event_secrets (
  event_id uuid primary key references public.events(id) on delete cascade,
  secret text not null default encode(sha256(convert_to(gen_random_uuid()::text || clock_timestamp()::text, 'utf8')), 'hex')
);
alter table public.event_secrets enable row level security;          -- no policies = no direct access
insert into public.event_secrets (event_id) select id from public.events;

create or replace function public.make_secret() returns trigger
language plpgsql security definer set search_path = public as $$
begin insert into public.event_secrets (event_id) values (new.id); return new; end $$;
create trigger events_make_secret after insert on public.events for each row execute function public.make_secret();

drop function if exists public.record_attendance(text);
alter table public.events drop column qr_token;
alter table public.events add column late_after_minutes int not null default 15 check (late_after_minutes between 0 and 600);
alter table public.events add column closed_at timestamptz;
alter table public.attendance add column offline boolean not null default false;

create or replace function public.events_closed_at() returns trigger language plpgsql as $$
begin
  if new.status = 'closed' and old.status <> 'closed' then new.closed_at := now();
  elsif new.status = 'open' then new.closed_at := null; end if;
  return new;
end $$;
create trigger events_closed_at before update on public.events for each row execute function public.events_closed_at();

-- 2. Rotating code: changes every 30 seconds, accepted for the current + previous slot
create or replace function public.qr_code(p_event uuid, p_slot bigint) returns text
language sql stable security definer set search_path = public as $$
  select p_event::text || ':' || substr(encode(sha256(convert_to(s.secret || p_slot::text, 'utf8')), 'hex'), 1, 16)
  from public.event_secrets s where s.event_id = p_event $$;
revoke all on function public.qr_code(uuid, bigint) from public, anon, authenticated;

create or replace function public.current_qr(p_event uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare ev public.events%rowtype;
begin
  select * into ev from public.events where id = p_event;
  if not found or public.my_role() not in ('teacher','admin')
     or (public.my_role() = 'teacher' and ev.created_by <> auth.uid()) then raise exception 'UNAUTHORIZED'; end if;
  if ev.status <> 'open' then raise exception 'EVENT_CLOSED'; end if;
  return public.qr_code(p_event, floor(extract(epoch from now()) / 30)::bigint);
end $$;
revoke all on function public.current_qr(uuid) from public, anon;
grant execute on function public.current_qr(uuid) to authenticated;

-- 3. Attendance: validates rotating code, closed events, duplicates, late status, offline scans
create or replace function public.record_attendance(p_token text, p_scanned_at timestamptz default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev public.events%rowtype; eid uuid; at timestamptz; slot bigint; st text := 'present';
begin
  if auth.uid() is null or public.my_role() <> 'student' then raise exception 'UNAUTHORIZED'; end if;
  begin eid := split_part(p_token, ':', 1)::uuid; exception when others then raise exception 'INVALID_QR'; end;
  select * into ev from public.events where id = eid;
  if not found then raise exception 'INVALID_QR'; end if;
  if p_scanned_at is not null and (p_scanned_at < now() - interval '24 hours' or p_scanned_at > now() + interval '1 minute') then raise exception 'EXPIRED_QR'; end if;
  at := coalesce(p_scanned_at, now());
  if ev.status <> 'open' and (p_scanned_at is null or ev.closed_at is null or p_scanned_at > ev.closed_at) then raise exception 'EVENT_CLOSED'; end if;
  slot := floor(extract(epoch from at) / 30)::bigint;
  if p_token is distinct from public.qr_code(eid, slot) and p_token is distinct from public.qr_code(eid, slot - 1) then raise exception 'EXPIRED_QR'; end if;
  if at > ((ev.event_date + ev.event_time) at time zone 'Asia/Manila') + make_interval(mins => ev.late_after_minutes) then st := 'late'; end if;
  begin
    insert into public.attendance (event_id, student_id, status, scanned_at, offline) values (eid, auth.uid(), st, at, p_scanned_at is not null);
  exception when unique_violation then raise exception 'DUPLICATE'; end;
  return jsonb_build_object('name', ev.name, 'status', st);
end $$;
revoke all on function public.record_attendance(text, timestamptz) from public, anon;
grant execute on function public.record_attendance(text, timestamptz) to authenticated;

-- 4. Analytics + dashboard (adds attendance rate)
create or replace function public.dashboard_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'events', e.n, 'open_events', e.o,
    'attendance', (select count(*) from public.attendance a where public.my_role() = 'admin'
                    or exists (select 1 from public.events x where x.id = a.event_id and x.created_by = auth.uid())),
    'my_attendance', m.n, 'rate', least(100, round(100.0 * m.n / greatest(e.n, 1))))
  from (select count(*) n, count(*) filter (where status = 'open') o from public.events) e,
       (select count(*) n from public.attendance where student_id = auth.uid()) m $$;

create or replace function public.analytics() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'events', coalesce((select jsonb_agg(x) from (
        select jsonb_build_object('id', e.id, 'name', e.name, 'date', e.event_date,
               'present', count(a.id) filter (where a.status <> 'late'), 'late', count(a.id) filter (where a.status = 'late')) x
        from public.events e left join public.attendance a on a.event_id = e.id
        where public.my_role() = 'admin' or (public.my_role() = 'teacher' and e.created_by = auth.uid())
        group by e.id order by e.event_date desc limit 8) s), '[]'::jsonb)) $$;
revoke all on function public.analytics() from public, anon;
grant execute on function public.analytics() to authenticated;
