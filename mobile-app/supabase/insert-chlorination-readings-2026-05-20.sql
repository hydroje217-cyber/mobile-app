-- Inserts/updates the May 20, 2026 chlorination house readings from the log sheet image.
-- Run this in the Supabase SQL Editor.
--
-- Uncertainty flags are SQL comments only. They are not inserted into remarks.
--
-- Review these before running:
-- - 0100H totalizer is hard to read; entered as 60385.1.
-- - 0200H totalizer is hard to read; entered as 60399.1 because it fits the sequence.
-- - 0230H turbidity is hard to read; entered as 0.056.
-- - 0300H turbidity is hard to read; entered as 0.058.
-- - 0800H RC and pH appear blank; entered as null.
-- - 1200H pH is hard to read; entered as 7.38.
-- - 1900H RC is hard to read; entered as 0.489.
-- - 2230H RC is hard to read; entered as 0.565.
-- - 2300H/2330H blue-ink readings are less clear; each row is flagged.
-- - Shift power consumption is placed on 0630H, 1430H, and 2230H per shift-end timing.
-- - Power meter readings from the sheet are 1406.8, 1408.5, and 1411.1 kWh, but the
--   table only has chlorination_power_kwh for shift consumption, not a power-meter
--   reading column.
-- - Peroxide usage of 4 L is placed on the 1430H shift-end row; chlorine usage is blank.

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
    v.chlorine_consumed::numeric,
    v.peroxide_consumption,
    v.chlorination_power_kwh
  from (
    values
      ('2026-05-20 00:00:00'::timestamp at time zone 'Asia/Manila', 41, 0.310, 0.056, 7.37, 161, 14.8, 60373.8, 'normal', null, null, null),
      ('2026-05-20 00:30:00'::timestamp at time zone 'Asia/Manila', 39, 0.350, 0.055, 7.36, 161, 11.9, 60379.6, 'normal', null, null, null),
      ('2026-05-20 01:00:00'::timestamp at time zone 'Asia/Manila', 35, 0.317, 0.055, 7.35, 160, 10.2, 60385.1, 'normal', null, null, null), -- UNCERTAIN: totalizer hard to read
      ('2026-05-20 01:30:00'::timestamp at time zone 'Asia/Manila', 36, 0.318, 0.055, 7.36, 160, 10.8, 60390.1, 'normal', null, null, null),
      ('2026-05-20 02:00:00'::timestamp at time zone 'Asia/Manila', 37, 0.410, 0.055, 7.35, 160, 10.3, 60399.1, 'normal', null, null, null), -- UNCERTAIN: totalizer hard to read; inferred from sequence
      ('2026-05-20 02:30:00'::timestamp at time zone 'Asia/Manila', 37, 0.372, 0.055, 7.35, 160, 10.2, 60404.3, 'normal', null, null, null), -- UNCERTAIN: turbidity hard to read
      ('2026-05-20 03:00:00'::timestamp at time zone 'Asia/Manila', 40, 0.302, 0.054, 7.31, 159, 10.4, 60407.2, 'normal', null, null, null), -- UNCERTAIN: turbidity hard to read
      ('2026-05-20 03:30:00'::timestamp at time zone 'Asia/Manila', 46, 0.355, 0.054, 7.31, 159, 12.7, 60410.3, 'normal', null, null, null),
      ('2026-05-20 04:00:00'::timestamp at time zone 'Asia/Manila', 40, 0.507, 0.053, 7.30, 159, 10.8, 60416.0, 'normal', null, null, null),
      ('2026-05-20 04:30:00'::timestamp at time zone 'Asia/Manila', 35, 0.529, 0.054, 7.28, 158, 14.1, 60427.2, 'normal', null, null, null),
      ('2026-05-20 05:00:00'::timestamp at time zone 'Asia/Manila', 46, 0.582, 0.053, 7.29, 158, 14.2, 60429.5, 'normal', null, null, null),
      ('2026-05-20 05:30:00'::timestamp at time zone 'Asia/Manila', 37, 0.391, 0.053, 7.30, 158, 16.5, 60437.3, 'normal', null, null, null),
      ('2026-05-20 06:00:00'::timestamp at time zone 'Asia/Manila', 30, 0.310, 0.053, 7.30, 158, 18.5, 60445.5, 'normal', null, null, null),
      ('2026-05-20 06:30:00'::timestamp at time zone 'Asia/Manila', 23, 0.327, 0.053, 7.28, 158, 17.7, 60455.8, 'normal', null, null, 1406.8), -- Shift-end power reading: 1406.8 kWh; chlorine usage blank
      ('2026-05-20 07:00:00'::timestamp at time zone 'Asia/Manila', 20, 0.453, 0.052, 7.36, 157, 19.9, 60466.2, 'NORMAL', null, null, null),
      ('2026-05-20 07:30:00'::timestamp at time zone 'Asia/Manila', 12, 0.542, 0.051, 7.38, 157, 19.6, 60474.0, 'NORMAL', null, null, null),
      ('2026-05-20 08:00:00'::timestamp at time zone 'Asia/Manila', 8, null, null, null, 157, 21.4, 60484.1, 'ANALYZER CLEANING', null, null, null), -- UNCERTAIN: RC and pH appear blank on sheet
      ('2026-05-20 08:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.839, 0.053, 7.46, 156, 19.3, 60495.7, 'NORMAL', null, null, null),
      ('2026-05-20 09:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.619, 0.053, 7.48, 154, 21.0, 60504.3, 'NORMAL', null, null, null),
      ('2026-05-20 09:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.087, 0.061, 7.52, 155, 18.8, 60514.3, 'NORMAL', null, null, null),
      ('2026-05-20 10:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.069, 0.062, 7.53, 154, 21.9, 60523.5, 'NORMAL', null, null, null),
      ('2026-05-20 10:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.064, 0.063, 7.53, 153, 19.1, 60524.8, 'NORMAL', null, null, null),
      ('2026-05-20 11:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.057, 0.061, 7.54, 153, 18.1, 60541.3, 'NORMAL', null, null, null),
      ('2026-05-20 11:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.059, 0.056, 7.54, 152, 17.9, 60551.4, 'NORMAL', null, null, null),
      ('2026-05-20 12:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.066, 0.051, 7.38, 151, 17.7, 60560.3, 'NORMAL', null, null, null), -- UNCERTAIN: pH hard to read
      ('2026-05-20 12:30:00'::timestamp at time zone 'Asia/Manila', 0, 0.061, 0.051, 7.33, 150, 18.4, 60569.0, 'NORMAL', null, null, null),
      ('2026-05-20 13:00:00'::timestamp at time zone 'Asia/Manila', 0, 0.856, 0.051, 7.35, 149, 17.1, 60579.0, 'NORMAL', null, null, null),
      ('2026-05-20 13:30:00'::timestamp at time zone 'Asia/Manila', 4, 0.863, 0.051, 7.35, 148, 17.2, 60587.0, 'NORMAL', null, null, null),
      ('2026-05-20 14:00:00'::timestamp at time zone 'Asia/Manila', 4, 0.740, 0.051, 7.33, 148, 18.1, 60596.7, 'NORMAL', null, null, null),
      ('2026-05-20 14:30:00'::timestamp at time zone 'Asia/Manila', 5, 0.652, 0.051, 7.38, 147, 15.7, 60604.7, 'NORMAL', null, 4, 1408.5), -- Shift-end power reading: 1408.5 kWh; chlorine usage blank
      ('2026-05-20 15:00:00'::timestamp at time zone 'Asia/Manila', 8, 0.668, 0.050, 7.33, 147, 18.2, 60616.7, 'normal', null, null, null),
      ('2026-05-20 15:30:00'::timestamp at time zone 'Asia/Manila', 8, 0.650, 0.051, 7.32, 147, 18.3, 60621.8, 'normal', null, null, null),
      ('2026-05-20 16:00:00'::timestamp at time zone 'Asia/Manila', 8, 0.627, 0.052, 7.34, 146, 17.9, 60630.2, 'normal', null, null, null),
      ('2026-05-20 16:30:00'::timestamp at time zone 'Asia/Manila', 10, 0.644, 0.051, 7.36, 146, 16.9, 60639.6, 'normal', null, null, null),
      ('2026-05-20 17:00:00'::timestamp at time zone 'Asia/Manila', 8, 0.516, 0.053, 7.40, 146, 20.1, 60649.4, 'normal', null, null, null),
      ('2026-05-20 17:30:00'::timestamp at time zone 'Asia/Manila', 7, 0.756, 0.052, 7.42, 145, 18.5, 60659.4, 'normal', null, null, null),
      ('2026-05-20 18:00:00'::timestamp at time zone 'Asia/Manila', 6, 0.769, 0.052, 7.44, 144, 18.4, 60667.3, 'normal', null, null, null),
      ('2026-05-20 18:30:00'::timestamp at time zone 'Asia/Manila', 6, 0.510, 0.055, 7.44, 143, 17.5, 60678.2, 'normal', null, null, null),
      ('2026-05-20 19:00:00'::timestamp at time zone 'Asia/Manila', 6, 0.481, 0.054, 7.47, 142, 17.8, 60686.3, 'normal', null, null, null), -- UNCERTAIN: RC hard to read
      ('2026-05-20 19:30:00'::timestamp at time zone 'Asia/Manila', 6, 0.438, 0.053, 7.43, 142, 17.8, 60693.9, 'normal', null, null, null),
      ('2026-05-20 20:00:00'::timestamp at time zone 'Asia/Manila', 10, 0.473, 0.053, 7.42, 141, 16.4, 60702.3, 'normal', null, null, null),
      ('2026-05-20 20:30:00'::timestamp at time zone 'Asia/Manila', 10, 0.572, 0.053, 7.42, 140, 17.4, 60709.7, 'normal', null, null, null),
      ('2026-05-20 21:00:00'::timestamp at time zone 'Asia/Manila', 10, 0.751, 0.053, 7.46, 139, 14.4, 60717.5, 'normal', null, null, null),
      ('2026-05-20 21:30:00'::timestamp at time zone 'Asia/Manila', 13, 0.419, 0.053, 7.42, 139, 14.8, 60724.7, 'normal', null, null, null),
      ('2026-05-20 22:00:00'::timestamp at time zone 'Asia/Manila', 18, 0.566, 0.053, 7.39, 139, 13.2, 60736.8, 'normal', null, null, null),
      ('2026-05-20 22:30:00'::timestamp at time zone 'Asia/Manila', 26, 0.565, 0.053, 7.35, 138, 12.8, 60738.7, 'normal', null, null, 1411.1), -- UNCERTAIN: RC hard to read; shift-end power reading: 1411.1 kWh; chlorine usage blank
      ('2026-05-20 23:00:00'::timestamp at time zone 'Asia/Manila', 25, 0.592, 0.053, 7.33, 138, 12.3, 60741.6, 'NORMAL', null, null, null), -- UNCERTAIN: blue-ink row
      ('2026-05-20 23:30:00'::timestamp at time zone 'Asia/Manila', 20, 0.514, 0.053, 7.33, 137, 10.3, 60748.6, 'NORMAL', null, null, null) -- UNCERTAIN: blue-ink row
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
