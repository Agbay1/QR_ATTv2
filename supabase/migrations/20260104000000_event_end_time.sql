-- QR-ATT migration 4: optional event END TIME (auto-close).
-- SAFE / ADDITIVE: nothing is dropped, no existing rows or columns change.
--   * adds one nullable column  events.end_at
--   * replaces record_attendance / current_qr (same names + signatures) to honour end_at
--   * adds close_expired_events()
-- Events without an end time behave exactly as before. Old app copies keep working.
-- Run AFTER migrations 1-3 (SQL editor -> paste -> Run). Safe to run twice.

alter table public.events add column if not exists end_at timestamptz;

-- Scans after the end time are rejected even if nobody has closed the event yet.
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
  if ev.end_at is not null and at > ev.end_at then raise exception 'EVENT_CLOSED'; end if;      -- NEW
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

-- Teacher QR screen stops issuing codes after the end time.
create or replace function public.current_qr(p_event uuid) returns text
language plpgsql stable security definer set search_path = public as $$
declare ev public.events%rowtype;
begin
  select * into ev from public.events where id = p_event;
  if not found or public.my_role() not in ('teacher','admin')
     or (public.my_role() = 'teacher' and ev.created_by <> auth.uid()) then raise exception 'UNAUTHORIZED'; end if;
  if ev.status <> 'open' or (ev.end_at is not null and now() > ev.end_at) then raise exception 'EVENT_CLOSED'; end if;   -- NEW: end_at
  return public.qr_code(p_event, floor(extract(epoch from now()) / 30)::bigint);
end $$;
revoke all on function public.current_qr(uuid) from public, anon;
grant execute on function public.current_qr(uuid) to authenticated;

-- Flips events whose end time has passed to 'closed' (the app calls this about once a minute).
-- Any signed-in user may call it: it only closes events that are already past their own end time.
create or replace function public.close_expired_events() returns int
language plpgsql security definer set search_path = public as $$
declare ids uuid[];
begin
  with c as (update public.events set status = 'closed'
             where status = 'open' and end_at is not null and end_at <= now() returning id)
  select coalesce(array_agg(id), '{}') into ids from c;
  -- the closed_at trigger stamps now(); record the real end time instead so late offline syncs are judged fairly
  update public.events set closed_at = end_at where id = any(ids);
  return coalesce(array_length(ids, 1), 0);
end $$;
revoke all on function public.close_expired_events() from public, anon;
grant execute on function public.close_expired_events() to authenticated;
