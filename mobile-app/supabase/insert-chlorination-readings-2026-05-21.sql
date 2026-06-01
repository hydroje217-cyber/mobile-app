-- Inserts/updates the May 21, 2026 chlorination house readings from the log sheet image.
-- Run this in the Supabase SQL Editor.
--
-- Uncertainty flags are SQL comments only. They are not inserted into remarks.
--
-- Review these before running:
-- - 0100H pressure is hard to read; entered as 43.
-- - 0300H RC is hard to read; entered as 0.648.
-- - 0500H RC is hard to read; entered as 0.508.
-- - 0700H row totalizer appears to be 60833.6, while the shift summary shows 60832.6.
-- - 2100H totalizer is hard to read; entered as 61079.9.
-- - 2330H RC is hard to read; entered as 0.510.
-- - Power meter readings are placed on 0630H, 1430H, and 2230H per shift-end timing.
-- - Chlorine usage and peroxide usage appear blank on the sheet.

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
    remarks,
    totalizer,
    pressure_psi,
    rc_ppm,
    turbidity_ntu,
    ph,
    tds_ppm,
    tank_level_liters,
    flowrate_m3hr,
    chlorine_consumed,
    peroxide_consumption,
    chlorination_power_kwh
  )
  select
    target_site_id,
    submitter_id,
    v.slot_at,
    v.slot_at,
    'submitted',
    v.base_remarks,
    v.totalizer,
    v.pressure_psi,
    v.rc_ppm,
    v.turbidity_ntu,
    v.ph,
    null::numeric,
    v.tank_level_liters,
    v.flowrate_m3hr,
    v.chlorine_consumed,
    v.peroxide_consumption,
    v.chlorination_power_kwh
  from (
    values
      ('2026-05-21 00:00:00'::timestamp at time zone 'Asia/Manila', 36, 0.557, 0.055, 7.35, 137, 9.1, 60754.2, 'NORMAL', null::numeric, null::numeric, null::numeric),
      ('2026-05-21 00:30:00'::timestamp at time zone 'Asia/Manila', 39, 0.692, 0.053, 7.34, 137, 9.8, 60759.1, 'NORMAL', null, null, null),
      ('2026-05-21 01:00:00'::timestamp at time zone 'Asia/Manila', 43, 0.639, 0.053, 7.32, 136, 8.8, 60763.7, 'NORMAL', null, null, null), -- UNCERTAIN: pressure hard to read
      ('2026-05-21 01:30:00'::timestamp at time zone 'Asia/Manila', 40, 0.792, 0.053, 7.32, 136, 8.2, 60767.6, 'NORMAL', null, null, null),
      ('2026-05-21 02:00:00'::timestamp at time zone 'Asia/Manila', 40, 0.611, 0.053, 7.32, 135, 8.9, 60772.1, 'NORMAL', null, null, null),
      ('2026-05-21 02:30:00'::timestamp at time zone 'Asia/Manila', 40, 0.651, 0.052, 7.32, 135, 8.0, 60776.5, 'NORMAL', null, null, null),
      ('2026-05-21 03:00:00'::timestamp at time zone 'Asia/Manila', 40, 0.648, 0.052, 7.32, 134, 7.8, 60780.3, 'NORMAL', null, null, null), -- UNCERTAIN: RC hard to read
      ('2026-05-21 03:30:00'::timestamp at time zone 'Asia/Manila', 40, 0.572, 0.052, 7.32, 134, 9.1, 60785.4, 'NORMAL', null, null, null),
      ('2026-05-21 04:00:00'::timestamp at time zone 'Asia/Manila', 39, 0.601, 0.052, 7.30, 133, 8.3, 60789.8, 'NORMAL', null, null, null),
      ('2026-05-21 04:30:00'::timestamp at time zone 'Asia/Manila', 39, 0.657, 0.052, 7.29, 133, 8.7, 60793.7, 'NORMAL', null, null, null),
      ('2026-05-21 05:00:00'::timestamp at time zone 'Asia/Manila', 37, 0.508, 0.052, 7.29, 132, 9.4, 60798.9, 'NORMAL', null, null, null), -- UNCERTAIN: RC hard to read
      ('2026-05-21 05:30:00'::timestamp at time zone 'Asia/Manila', 40, 0.639, 0.051, 7.28, 132, 14.5, 60806.0, 'NORMAL', null, null, null),
      ('2026-05-21 06:00:00'::timestamp at time zone 'Asia/Manila', 38, 0.653, 0.051, 7.29, 131, 18.1, 60812.9, 'NORMAL', null, null, null),
      ('2026-05-21 06:30:00'::timestamp at time zone 'Asia/Manila', 35, 0.629, 0.051, 7.27, 131, 17.4, 60821.1, 'NORMAL', null, null, 1413.2), -- Shift-end power reading
      ('2026-05-21 07:00:00'::timestamp at time zone 'Asia/Manila', 26, 0.627, 0.050, 7.24, 130, 17.7, 60833.6, 'NORMAL', null, null, null), -- UNCERTAIN: shift summary shows 60832.6
      ('2026-05-21 07:30:00'::timestamp at time zone 'Asia/Manila', 16, 0.667, 0.051, 7.34, 130, 20.5, 60841.5, 'NORMAL', null, null, null),
      ('2026-05-21 08:00:00'::timestamp at time zone 'Asia/Manila', 10, 0.540, 0.050, 7.35, 129, 19.1, 60850.9, 'NORMAL', null, null, null),
      ('2026-05-21 08:30:00'::timestamp at time zone 'Asia/Manila', 7, 0.526, 0.051, 7.38, 128, 19.5, 60861.5, 'NORMAL', null, null, null),
      ('2026-05-21 09:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.307, 0.052, 7.40, 127, 19.3, 60870.4, 'NORMAL', null, null, null),
      ('2026-05-21 09:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.157, 0.051, 7.40, 125, 21.0, 60880.7, 'NORMAL', null, null, null),
      ('2026-05-21 10:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.128, 0.050, 7.46, 123, 18.3, 60890.2, 'NORMAL', null, null, null),
      ('2026-05-21 10:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.061, 0.049, 7.47, 121, 18.9, 60900.1, 'NORMAL', null, null, null),
      ('2026-05-21 11:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.080, 0.050, 7.43, 118, 17.0, 60910.0, 'NORMAL', null, null, null),
      ('2026-05-21 11:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.077, 0.050, 7.45, 116, 18.5, 60918.6, 'NORMAL', null, null, null),
      ('2026-05-21 12:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.193, 0.050, 7.46, 114, 17.8, 60928.3, 'NORMAL', null, null, null),
      ('2026-05-21 12:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.146, 0.049, 7.42, 112, 17.5, 60935.9, 'NORMAL', null, null, null),
      ('2026-05-21 13:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.087, 0.048, 7.43, 110, 16.1, 60945.3, 'NORMAL', null, null, null),
      ('2026-05-21 13:30:00'::timestamp at time zone 'Asia/Manila', 10, 0.563, 0.049, 7.30, 110, 16.5, 60955.6, 'NORMAL', null, null, null),
      ('2026-05-21 14:00:00'::timestamp at time zone 'Asia/Manila', 11, 0.609, 0.049, 7.30, 109, 16.3, 60962.9, 'NORMAL', null, null, null),
      ('2026-05-21 14:30:00'::timestamp at time zone 'Asia/Manila', 13, 0.587, 0.049, 7.29, 109, 15.4, 60969.7, 'NORMAL', null, null, 1414.6), -- Shift-end power reading
      ('2026-05-21 15:00:00'::timestamp at time zone 'Asia/Manila', 18, 0.607, 0.048, 7.31, 108, 15.3, 60976.9, 'NORMAL', null, null, null),
      ('2026-05-21 15:30:00'::timestamp at time zone 'Asia/Manila', 20, 0.661, 0.049, 7.32, 108, 14.6, 60986.2, 'NORMAL', null, null, null),
      ('2026-05-21 16:00:00'::timestamp at time zone 'Asia/Manila', 21, 0.480, 0.050, 7.34, 107, 17.6, 60994.8, 'NORMAL', null, null, null),
      ('2026-05-21 16:30:00'::timestamp at time zone 'Asia/Manila', 21, 0.523, 0.049, 7.34, 107, 19.2, 61003.2, 'NORMAL', null, null, null),
      ('2026-05-21 17:00:00'::timestamp at time zone 'Asia/Manila', 23, 0.482, 0.050, 7.35, 106, 16.5, 61011.9, 'NORMAL', null, null, null),
      ('2026-05-21 17:30:00'::timestamp at time zone 'Asia/Manila', 26, 0.674, 0.049, 7.35, 106, 14.2, 61020.9, 'NORMAL', null, null, null),
      ('2026-05-21 18:00:00'::timestamp at time zone 'Asia/Manila', 24, 0.553, 0.050, 7.34, 105, 18.6, 61028.4, 'NORMAL', null, null, null),
      ('2026-05-21 18:30:00'::timestamp at time zone 'Asia/Manila', 19, 0.513, 0.052, 7.36, 105, 14.3, 61036.0, 'NORMAL', null, null, null),
      ('2026-05-21 19:00:00'::timestamp at time zone 'Asia/Manila', 20, 0.538, 0.051, 7.39, 104, 16.4, 61046.3, 'NORMAL', null, null, null),
      ('2026-05-21 19:30:00'::timestamp at time zone 'Asia/Manila', 24, 0.639, 0.052, 7.41, 103, 16.9, 61053.7, 'NORMAL', null, null, null),
      ('2026-05-21 20:00:00'::timestamp at time zone 'Asia/Manila', 25, 0.615, 0.053, 7.40, 102, 15.5, 61062.7, 'NORMAL', null, null, null),
      ('2026-05-21 20:30:00'::timestamp at time zone 'Asia/Manila', 24, 0.620, 0.052, 7.40, 101, 16.2, 61072.0, 'NORMAL', null, null, null),
      ('2026-05-21 21:00:00'::timestamp at time zone 'Asia/Manila', 35, 0.397, 0.051, 7.41, 100, 15.1, 61079.9, 'NORMAL', null, null, null), -- UNCERTAIN: totalizer hard to read
      ('2026-05-21 21:30:00'::timestamp at time zone 'Asia/Manila', 44, 0.588, 0.051, 7.44, 99, 15.7, 61086.6, 'NORMAL', null, null, null),
      ('2026-05-21 22:00:00'::timestamp at time zone 'Asia/Manila', 44, 0.568, 0.051, 7.46, 99, 13.7, 61093.1, 'NORMAL', null, null, null),
      ('2026-05-21 22:30:00'::timestamp at time zone 'Asia/Manila', 42, 0.547, 0.052, 7.49, 98, 10.1, 61099.6, 'NORMAL', null, null, 1416.7), -- Shift-end power reading
      ('2026-05-21 23:00:00'::timestamp at time zone 'Asia/Manila', 45, 0.419, 0.052, 7.42, 98, 9.4, 61104.9, 'NORMAL', null, null, null),
      ('2026-05-21 23:30:00'::timestamp at time zone 'Asia/Manila', 49, 0.510, 0.052, 7.41, 97, 8.2, 61109.1, 'NORMAL', null, null, null) -- UNCERTAIN: RC hard to read
  ) as v(
    slot_at,
    pressure_psi,
    rc_ppm,
    turbidity_ntu,
    ph,
    tank_level_liters,
    flowrate_m3hr,
    totalizer,
    base_remarks,
    chlorine_consumed,
    peroxide_consumption,
    chlorination_power_kwh
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
    chlorine_consumed = excluded.chlorine_consumed,
    peroxide_consumption = excluded.peroxide_consumption,
    chlorination_power_kwh = excluded.chlorination_power_kwh,
    updated_at = timezone('utc', now());
end $$;
