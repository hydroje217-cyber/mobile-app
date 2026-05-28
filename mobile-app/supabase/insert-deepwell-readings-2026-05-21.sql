-- Inserts/updates the May 21, 2026 Deepwell daily monitoring sheet.
-- Run this in the Supabase SQL Editor.
--
-- UNCERTAIN VALUES TO REVIEW BEFORE RUNNING:
-- - 0700H downstream pressure: read as 22 after correction/scribble.
-- - 1030H flowrate: read as 18.9.
-- - 1100H voltage L3: read as 454.7.
-- - 1500H voltage L3: read as 452.8.
-- - 1530H voltage L1/L2/L3: read as 429.1 / 445.3 / 460.9.
-- - 1600H voltage L2: read as 443.4.
-- - 2030H upstream/downstream pressure: read as 45 / 26 after scribble.
-- - 2200H flowrate/frequency: read as 13.7 / 48.
-- - 2230H frequency: read as 38.
-- - B-shift power reading: read as 51310.

do $$
declare
  submitter_id uuid;
  target_site_id bigint;
  local_reading_date date := date '2026-05-21';
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
  where type = 'DEEPWELL'
  order by
    case when name = 'Main Deepwell Pump' then 0 else 1 end,
    id asc
  limit 1;

  if target_site_id is null then
    raise exception 'No deepwell site found.';
  end if;

  with source_rows (
    slot_time,
    upstream_pressure_psi,
    downstream_pressure_psi,
    flowrate_m3hr,
    vfd_frequency_hz,
    voltage_l1_v,
    voltage_l2_v,
    voltage_l3_v,
    amperage_a,
    tds_ppm,
    power_kwh_shift,
    remarks
  ) as (
    values
      ('00:00'::time, 35, 15, 9.1, 38, 459.5, 455.1, 462.9, 24.06, null, null, '3/4 TURN'),
      ('00:30'::time, 30, 20, 9.8, 36, 459.1, 454.1, 462.7, 22.19, null, null, '3/4 TURN'),
      ('01:00'::time, 40, 35, 8.8, 36, 460.1, 455.7, 463.6, 22.23, null, null, '3/4 TURN'),
      ('01:30'::time, 40, 40, 8.2, 36, 460.3, 455.0, 463.5, 22.18, null, null, '3/4 TURN'),
      ('02:00'::time, 40, 40, 8.9, 36, 460.0, 456.7, 463.4, 22.17, null, null, '3/4 TURN'),
      ('02:30'::time, 40, 40, 9.0, 36, 459.9, 455.3, 463.1, 22.29, null, null, '3/4 TURN'),
      ('03:00'::time, 40, 40, 7.8, 36, 453.1, 457.2, 457.3, 22.21, null, null, '3/4 TURN'),
      ('03:30'::time, 40, 40, 9.1, 36, 451.0, 448.0, 454.7, 22.19, null, null, '3/4 TURN'),
      ('04:00'::time, 40, 40, 8.3, 36, 456.1, 451.0, 454.4, 22.24, null, null, '3/4 TURN'),
      ('04:30'::time, 50, 35, 8.7, 42, 452.6, 449.0, 455.1, 27.71, null, null, '3/4 TURN'),
      ('05:00'::time, 50, 35, 9.6, 42, 457.5, 448.6, 454.8, 27.72, null, null, '3/4 TURN'),
      ('05:30'::time, 50, 35, 14.5, 42, 454.6, 450.2, 456.0, 27.69, null, null, '3/4 TURN'),
      ('06:00'::time, 50, 30, 18.1, 44, 464.1, 457.2, 465.2, 29.69, null, null, '3/4 TURN'),
      ('06:30'::time, 50, 30, 17.4, 48, 464.0, 457.1, 464.6, 33.88, null, 51182, '3/4 TURN'),
      ('07:00'::time, 45, 22, 17.7, 48, 469.1, 463.0, 469.5, 33.87, null, null, '3/4 TURN'), -- UNCERTAIN downstream_pressure_psi after correction/scribble.
      ('07:30'::time, 40, 16, 20.5, 48, 465.7, 462.2, 467.8, 33.58, null, null, '3/4 TURN'),
      ('08:00'::time, 40, 10, 18.1, 48, 458.8, 456.6, 460.3, 33.42, null, null, '3/4 TURN'),
      ('08:30'::time, 35, 7, 19.5, 48, 470.4, 467.8, 471.8, 32.73, null, null, '3/4 TURN'),
      ('09:00'::time, 35, 0, 19.3, 47, 460.1, 456.8, 462.5, 32.51, null, null, '3/4 TURN'),
      ('09:30'::time, 35, null, 21.0, 47, 459.6, 455.7, 460.6, 32.53, null, null, '3/4 TURN'),
      ('10:00'::time, 33, null, 18.3, 47, 458.4, 454.6, 459.8, 32.56, null, null, '3/4 TURN'),
      ('10:30'::time, 35, null, 18.9, 47, 457.1, 454.9, 458.3, 32.44, null, null, '3/4 TURN'), -- UNCERTAIN flowrate_m3hr.
      ('11:00'::time, 35, null, 17.8, 47, 454.2, 450.5, 454.7, 32.47, null, null, '3/4 TURN'), -- UNCERTAIN voltage_l3_v.
      ('11:30'::time, 35, null, 18.5, 47, 458.1, 454.6, 459.6, 32.49, null, null, '3/4 TURN'),
      ('12:00'::time, 35, null, 17.8, 47, 464.2, 462.8, 466.3, 32.48, null, null, '3/4 TURN'),
      ('12:30'::time, 35, null, 17.5, 47, 457.6, 456.1, 460.8, 32.46, null, null, '3/4 TURN'),
      ('13:00'::time, 35, 8, 16.5, 47, 461.7, 459.7, 463.8, 32.78, null, null, '3/4 TURN'),
      ('13:30'::time, 38, 11, 16.5, 47, 450.3, 449.9, 454.1, 32.83, null, null, '3/4 TURN'),
      ('14:00'::time, 38, 12, 16.3, 47, 448.7, 447.9, 452.5, 32.86, null, null, '3/4 TURN'),
      ('14:30'::time, 35, 16, 15.4, 47, 444.0, 442.1, 447.8, 32.84, null, 51310, '3/4 TURN'), -- UNCERTAIN power_kwh_shift read as 51310.
      ('15:00'::time, 40, 17, 15.3, 47, 447.8, 446.4, 452.8, 32.88, null, null, '3/4 TURN'), -- UNCERTAIN voltage_l3_v.
      ('15:30'::time, 40, 20, 14.6, 47, 429.1, 445.3, 460.9, 32.81, null, null, '3/4 TURN'), -- UNCERTAIN voltage_l1_v/voltage_l2_v/voltage_l3_v.
      ('16:00'::time, 42, 22, 17.6, 47, 468.2, 443.4, 450.9, 32.61, null, null, '3/4 TURN'), -- UNCERTAIN voltage_l2_v.
      ('16:30'::time, 42, 22, 17.2, 47, 455.1, 450.8, 457.6, 32.79, null, null, '3/4 TURN'),
      ('17:00'::time, 43, 23, 16.5, 47, 457.7, 451.8, 460.5, 32.88, null, null, '3/4 TURN'),
      ('17:30'::time, 45, 25, 16.2, 47, 453.5, 448.3, 456.9, 32.87, null, null, '3/4 TURN'),
      ('18:00'::time, 44, 22, 18.6, 47, 438.1, 433.2, 442.3, 32.77, null, null, '3/4 TURN'),
      ('18:30'::time, 43, 22, 19.3, 47, 427.9, 421.9, 435.3, 32.75, null, null, '3/4 TURN'),
      ('19:00'::time, 40, 19, 16.4, 47, 436.1, 429.1, 443.9, 32.79, null, null, '3/4 TURN'),
      ('19:30'::time, 42, 22, 16.9, 47, 441.1, 438.9, 453.0, 32.76, null, null, '3/4 TURN'),
      ('20:00'::time, 44, 24, 15.5, 47, 461.7, 449.2, 463.3, 32.86, null, null, '3/4 TURN'),
      ('20:30'::time, 45, 26, 16.2, 47, 450.2, 448.0, 462.6, 32.81, null, null, '3/4 TURN'), -- UNCERTAIN upstream/downstream after scribble.
      ('21:00'::time, 50, 33, 15.1, 47, 479.9, 477.5, 460.5, 32.71, null, null, '3/4 TURN'),
      ('21:30'::time, 54, 39, 15.7, 47, 453.7, 450.2, 453.7, 32.73, null, null, '3/4 TURN'),
      ('22:00'::time, 50, 39, 13.7, 48, 455.6, 453.4, 460.6, 27.77, null, null, '3/4 TURN'), -- UNCERTAIN flowrate_m3hr/vfd_frequency_hz.
      ('22:30'::time, 42, 35, 10.1, 38, 441.1, 434.9, 448.2, 24.08, null, 51432, '3/4 TURN'), -- UNCERTAIN vfd_frequency_hz.
      ('23:00'::time, 45, 40, 9.4, 38, 449.4, 443.2, 456.5, 24.07, null, null, '3/4 TURN'),
      ('23:30'::time, 45, 40, 8.2, 38, 449.3, 443.2, 455.5, 24.08, null, null, '3/4 TURN')
  ),
  prepared_rows as (
    select
      target_site_id as site_id,
      submitter_id as submitted_by,
      ((local_reading_date::timestamp + slot_time) at time zone 'Asia/Manila') as slot_at,
      upstream_pressure_psi,
      downstream_pressure_psi,
      flowrate_m3hr,
      vfd_frequency_hz,
      voltage_l1_v,
      voltage_l2_v,
      voltage_l3_v,
      amperage_a,
      tds_ppm::numeric as tds_ppm,
      power_kwh_shift,
      remarks
    from source_rows
  )
  insert into public.deepwell_readings (
    site_id,
    submitted_by,
    reading_datetime,
    slot_datetime,
    status,
    remarks,
    upstream_pressure_psi,
    downstream_pressure_psi,
    flowrate_m3hr,
    vfd_frequency_hz,
    voltage_l1_v,
    voltage_l2_v,
    voltage_l3_v,
    amperage_a,
    tds_ppm,
    power_kwh_shift
  )
  select
    site_id,
    submitted_by,
    slot_at,
    slot_at,
    'submitted',
    remarks,
    upstream_pressure_psi,
    downstream_pressure_psi,
    flowrate_m3hr,
    vfd_frequency_hz,
    voltage_l1_v,
    voltage_l2_v,
    voltage_l3_v,
    amperage_a,
    tds_ppm,
    power_kwh_shift
  from prepared_rows
  on conflict (site_id, slot_datetime)
  do update set
    submitted_by = excluded.submitted_by,
    reading_datetime = excluded.reading_datetime,
    status = excluded.status,
    remarks = excluded.remarks,
    upstream_pressure_psi = excluded.upstream_pressure_psi,
    downstream_pressure_psi = excluded.downstream_pressure_psi,
    flowrate_m3hr = excluded.flowrate_m3hr,
    vfd_frequency_hz = excluded.vfd_frequency_hz,
    voltage_l1_v = excluded.voltage_l1_v,
    voltage_l2_v = excluded.voltage_l2_v,
    voltage_l3_v = excluded.voltage_l3_v,
    amperage_a = excluded.amperage_a,
    tds_ppm = excluded.tds_ppm,
    power_kwh_shift = excluded.power_kwh_shift,
    updated_at = timezone('utc', now());
end $$;
