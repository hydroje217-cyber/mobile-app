-- Inserts/updates only the May 19, 2026 chlorination values requested:
-- - 2230H power reading: 1405.4
-- - 2300H totalizer: 60357.1
--
-- Run this in the Supabase SQL Editor.

do $$
declare
  submitter_id uuid;
  target_site_id bigint;
begin
  select id
  into submitter_id
  from public.profiles
  where is_active = true
    and (is_approved = true or role in ('admin', 'manager', 'supervisor', 'general_manager'))
  order by
    case role
      when 'admin' then 1
      when 'manager' then 2
      when 'supervisor' then 3
      when 'general_manager' then 4
      else 5
    end,
    created_at asc
  limit 1;

  if submitter_id is null then
    raise exception 'No approved/office profile found. Approve one user first, then run this insert.';
  end if;

  select id
  into target_site_id
  from public.sites
  where type = 'CHLORINATION'
  order by
    case when name = 'Main Chlorination Facility' then 0 else 1 end,
    id asc
  limit 1;

  if target_site_id is null then
    raise exception 'No chlorination site found.';
  end if;

  insert into public.chlorination_readings (
    site_id,
    submitted_by,
    reading_datetime,
    slot_datetime,
    status,
    totalizer,
    chlorination_power_kwh
  )
  select
    target_site_id,
    submitter_id,
    v.slot_at,
    v.slot_at,
    'submitted',
    v.totalizer,
    v.chlorination_power_kwh
  from (
    values
      ('2026-05-19 22:30:00'::timestamp at time zone 'Asia/Manila', null::numeric, 1405.4::numeric),
      ('2026-05-19 23:00:00'::timestamp at time zone 'Asia/Manila', 60357.1::numeric, null::numeric)
  ) as v(slot_at, totalizer, chlorination_power_kwh)
  on conflict (site_id, slot_datetime)
  do update set
    submitted_by = excluded.submitted_by,
    reading_datetime = excluded.reading_datetime,
    status = excluded.status,
    totalizer = coalesce(excluded.totalizer, public.chlorination_readings.totalizer),
    chlorination_power_kwh = coalesce(excluded.chlorination_power_kwh, public.chlorination_readings.chlorination_power_kwh),
    updated_at = timezone('utc', now());
end $$;
