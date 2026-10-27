-- QR-ATT migration 5: departments + department analytics.
-- SAFE / ADDITIVE: no tables or columns are dropped and no existing rows change.
--   * adds table  departments  (the 4 school departments)
--   * adds column profiles.department  (nullable, so every existing user keeps working)
--   * replaces handle_new_user()  (also saves the department chosen at sign-up)
--   * replaces analytics()  (same keys as before + 'departments' and a per-event 'by_dept')
-- Run AFTER migrations 1-4 (SQL editor -> paste -> Run). Safe to run twice.

-- 1. Departments --------------------------------------------------------------------------
create table if not exists public.departments (
  code text primary key,
  name text not null unique,
  sort int  not null default 0
);

insert into public.departments (code, name, sort) values
  ('CCS', 'College of Computer Studies',                 1),
  ('CTE', 'College of Teacher Education',                2),
  ('HMD', 'Hospitality Management Department',           3),
  ('BED', 'Business / Entrepreneurship Department',      4)
on conflict (code) do update set name = excluded.name, sort = excluded.sort;

alter table public.departments enable row level security;
drop policy if exists "departments read" on public.departments;
create policy "departments read" on public.departments for select to authenticated using (true);
drop policy if exists "departments admin all" on public.departments;
create policy "departments admin all" on public.departments for all to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- 2. Each profile can belong to one department ----------------------------------------------
-- (students may change their own; the existing "profiles update own" policy already allows it
--  and still blocks role changes)
alter table public.profiles
  add column if not exists department text references public.departments(code) on update cascade on delete set null;
create index if not exists profiles_department_idx on public.profiles (department);

-- 3. Sign-up saves the department picked in the app (ignored if it is not a real code) ------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare d text := nullif(trim(new.raw_user_meta_data->>'department'), '');
begin
  if d is not null and not exists (select 1 from public.departments where code = d) then d := null; end if;
  insert into public.profiles (id, full_name, student_no, department)
  values (new.id,
          coalesce(nullif(trim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
          nullif(trim(new.raw_user_meta_data->>'student_no'), ''),
          d);
  return new;
end $$;

-- 4. Analytics: per-department numbers for the Stats tab -----------------------------------
-- Same visibility rules as before: admins see every event, teachers only their own.
create or replace function public.analytics() returns jsonb
language sql stable security definer set search_path = public as $$
  with scope as (
    select e.id, e.name, e.event_date, e.event_time
    from public.events e
    where public.my_role() = 'admin' or (public.my_role() = 'teacher' and e.created_by = auth.uid())
    order by e.event_date desc, e.event_time desc
    limit 8
  ),
  depts as (
    select code, name, sort from public.departments
    union all
    select 'NA', 'No department', 99
  ),
  stu as (
    select coalesce(department, 'NA') as dept, count(*) as n
    from public.profiles where role = 'student' group by 1
  ),
  att as (
    select a.event_id, coalesce(p.department, 'NA') as dept,
           count(*) filter (where a.status <> 'late') as present,
           count(*) filter (where a.status = 'late')  as late
    from public.attendance a
    join public.profiles p on p.id = a.student_id
    where a.event_id in (select id from scope)
    group by 1, 2
  )
  select jsonb_build_object(
    'students', (select count(*) from public.profiles where role = 'student'),
    'departments', (
      select coalesce(jsonb_agg(jsonb_build_object('code', d.code, 'name', d.name, 'students', coalesce(s.n, 0)) order by d.sort), '[]'::jsonb)
      from depts d left join stu s on s.dept = d.code
      where d.code <> 'NA' or coalesce(s.n, 0) > 0),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', e.id, 'name', e.name, 'date', e.event_date,
               'present', coalesce((select sum(t.present) from att t where t.event_id = e.id), 0),
               'late',    coalesce((select sum(t.late)    from att t where t.event_id = e.id), 0),
               'by_dept', coalesce((select jsonb_agg(jsonb_build_object('code', t.dept, 'present', t.present, 'late', t.late))
                                    from att t where t.event_id = e.id), '[]'::jsonb)
             ) order by e.event_date desc, e.event_time desc)
      from scope e), '[]'::jsonb)
  )
$$;
revoke all on function public.analytics() from public, anon;
grant execute on function public.analytics() to authenticated;

-- OPTIONAL: put existing students into a department (run one line per group you know):
-- update public.profiles set department = 'CCS' where role = 'student' and student_no like '2024-CCS-%';
