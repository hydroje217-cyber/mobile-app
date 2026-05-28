-- Inserts/updates the May 24, 2026 1500H chlorination reading.
-- Run this in the Supabase SQL Editor.

do $$
declare
  submitter_id uuid;
  target_site_id bigint;
  local_slot_at timestamptz := ('2026-05-24 15:00:00'::timestamp at time zone 'Asia/Manila');
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
    remarks,
    totalizer,
    pressure_psi,
    rc_ppm,
    turbidity_ntu,
    ph,
    tds_ppm,
    tank_level_liters,
    flowrate_m3hr,
    chlorination_power_kwh
  )
  values (
    target_site_id,
    submitter_id,
    local_slot_at,
    local_slot_at,
    'submitted',
    'NORMAL',
    62000.9,
    28,
    0.656,
    0.045,
    7.30,
    null,
    155,
    16.1,
    1429.1
  )
  on conflict (site_id, slot_datetime)
  do update set
    submitted_by = excluded.submitted_by,
    reading_datetime = excluded.reading_datetime,
    status = excluded.status,
    remarks = excluded.remarks,
    totalizer = excluded.totalizer,
    pressure_psi = excluded.pressure_psi,
    rc_ppm = excluded.rc_ppm,
    turbidity_ntu = excluded.turbidity_ntu,
    ph = excluded.ph,
    tds_ppm = excluded.tds_ppm,
    tank_level_liters = excluded.tank_level_liters,
    flowrate_m3hr = excluded.flowrate_m3hr,
    chlorination_power_kwh = excluded.chlorination_power_kwh,
    updated_at = timezone('utc', now());
end $$;
