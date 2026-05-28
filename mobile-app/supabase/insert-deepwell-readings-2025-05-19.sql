-- Inserts/updates the May 19, 2026 Deepwell daily monitoring sheet.
-- Run this in the Supabase SQL Editor.

do $$
declare
  submitter_id uuid;
  target_site_id bigint;
  local_reading_date date := date '2026-05-19';
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
      ('00:00'::time, 52, 25, 17.2, 47, 447.6, 444.2, 457.7, 32.71, null, null, '3/4 TURN'),
      ('00:30'::time, 52, 25, 16.5, 47, 449.5, 446.5, 459.1, 32.68, null, null, '3/4 TURN'),
      ('01:00'::time, 50, 25, 18.3, 47, 452.8, 447.7, 460.5, 32.75, null, null, '3/4 TURN'),
      ('01:30'::time, 52, 27, 16.9, 47, 459.5, 454.0, 460.4, 32.79, null, null, '3/4 TURN'),
      ('02:00'::time, 55, 30, 16.1, 47, 452.3, 447.5, 458.2, 32.72, null, null, '3/4 TURN'),
      ('02:30'::time, 60, 35, 14.8, 47, 454.4, 448.7, 459.1, 32.69, null, null, '3/4 TURN'),
      ('03:00'::time, 65, 40, 15.2, 47, 463.6, 457.0, 460.0, 32.77, null, null, '3/4 TURN'),
      ('03:30'::time, 65, 40, 15.9, 47, 450.0, 454.8, 463.5, 32.65, null, null, '3/4 TURN'),
      ('04:00'::time, 65, 40, 15.8, 47, 458.7, 454.2, 463.3, 32.70, null, null, '3/4 TURN'),
      ('04:30'::time, 62, 37, 15.1, 47, 465.6, 461.3, 469.4, 32.67, null, null, '3/4 TURN'),
      ('05:00'::time, 58, 30, 16.5, 47, 464.9, 459.8, 468.0, 32.75, null, null, '3/4 TURN'),
      ('05:30'::time, 55, 25, 19.0, 50, 462.8, 457.5, 465.3, 36.09, null, null, '1/2 TURN'),
      ('06:00'::time, 65, 15, 19.6, 52, 463.6, 488.0, 461.1, 38.10, null, null, '3/8 TURN'),
      ('06:30'::time, 60, 5, 19.7, 52, 468.2, 463.7, 470.2, 38.27, null, 50481, '3/8 TURN'),
      ('07:00'::time, 65, 0, 19.1, 52, 471.5, 467.1, 472.6, 38.28, null, null, '3/8 TURN SUPMEA'),
      ('07:30'::time, 65, 0, 19.2, 52, 469.6, 465.2, 471.1, 38.39, null, null, '3/8 TURN SUPMEA'),
      ('08:00'::time, 65, 0, 20.6, 52, 466.1, 466.4, 469.1, 38.38, null, null, '3/8 TURN SUPMEA'),
      ('08:30'::time, 65, 0, 20.1, 52, 463.7, 458.2, 464.4, 38.37, null, null, '3/8 TURN SUPMEA'),
      ('09:00'::time, 65, 0, 19.8, 52, 452.9, 447.4, 454.5, 38.31, null, null, '3/8 TURN SUPMEA'),
      ('09:30'::time, 65, 0, 20.8, 52, 451.6, 445.4, 459.1, 38.36, null, null, '3/8 TURN SUPMEA'),
      ('10:00'::time, 70, 0, 20.5, 53, 464.8, 460.6, 467.0, 39.24, null, null, '3/8 TURN SUPMEA'),
      ('10:30'::time, 70, 0, 20.3, 53, 458.3, 453.0, 461.2, 39.40, null, null, '3/8 TURN SUPMEA'),
      ('11:00'::time, 32, 0, 21.0, 48, 460.3, 453.8, 461.4, 33.15, null, null, '7/8 TURN SUPMEA'),
      ('11:30'::time, 32, 0, 20.4, 48, 449.2, 443.8, 452.8, 33.25, null, null, '7/8 TURN SUPMEA'),
      ('12:00'::time, 33, 0, 19.9, 48, 460.3, 456.9, 462.4, 33.26, null, null, '7/8 TURN SUPMEA'),
      ('12:30'::time, 35, 0, 19.4, 48, 459.6, 453.3, 460.2, 33.28, null, null, '7/8 TURN SUPMEA'),
      ('13:00'::time, 35, 0, 18.7, 48, 455.4, 450.8, 450.9, 33.29, null, null, '7/8 TURN SUPMEA'),
      ('13:30'::time, 35, 0, 19.0, 48, 443.8, 438.6, 445.7, 33.34, null, null, '7/8 TURN SUPMEA'),
      ('14:00'::time, 35, 0, 19.6, 48, 442.7, 438.4, 445.2, 33.37, null, null, '7/8 TURN SUPMEA'),
      ('14:30'::time, 35, 0, 19.2, 48, 444.6, 435.5, 445.3, 33.25, null, 50628, '7/8 TURN SUPMEA'),
      ('15:00'::time, 38, null, 18.4, 48, 442.0, 436.6, 444.1, 33.44, null, null, '7/8 TURN'),
      ('15:30'::time, 40, 7, 17.6, 48, 453.7, 451.5, 457.4, 33.57, null, null, '7/8 TURN'),
      ('16:00'::time, 46, 7, 18.9, 48, 446.0, 439.9, 445.8, 33.26, null, null, '3/4 TURN'),
      ('16:30'::time, 42, 8, 18.7, 48, 447.0, 440.9, 447.3, 33.22, null, null, '3/4 TURN'),
      ('17:00'::time, 37, 6, 20.0, 48, 451.0, 445.6, 453.2, 33.75, null, null, '3/4 TURN'),
      ('17:30'::time, 40, null, 19.6, 48, 447.2, 439.7, 449.7, 33.94, null, null, '3/4 TURN'),
      ('18:00'::time, 42, null, 17.0, 48, 448.1, 442.3, 462.8, 33.98, null, null, '3/4 TURN'),
      ('18:30'::time, 45, 8, 17.6, 48, 438.8, 430.7, 453.0, 33.83, null, null, '3/4 TURN'),
      ('19:00'::time, 44, 8, 18.0, 48, 450.9, 444.4, 456.2, 33.89, null, null, '3/4 TURN'),
      ('19:30'::time, 43, 9, 17.8, 48, 447.7, 444.8, 458.4, 33.75, null, null, '3/4 TURN'),
      ('20:00'::time, 42, 9, 18.3, 48, 446.6, 441.8, 454.9, 33.93, null, null, '7/8 TURN'),
      ('20:30'::time, 40, 10, 18.1, 48, 443.5, 437.9, 451.8, 33.47, null, null, '7/8 TURN'),
      ('21:00'::time, 40, 10, 17.4, 48, 445.4, 439.6, 453.5, 33.69, null, null, '7/8 TURN'),
      ('21:30'::time, 40, 10, 16.7, 48, 447.4, 446.6, 460.7, 33.70, null, null, '7/8 TURN'),
      ('22:00'::time, 60, 13, 18.3, 48, 451.0, 449.0, 462.7, 33.21, null, null, '7/8 TURN'),
      ('22:30'::time, 40, 15, 16.3, 48, 454.3, 448.6, 461.3, 33.47, null, 50763, '7/8 TURN'),
      ('23:00'::time, 40, 15, 15.3, 48, 447.5, 441.6, 453.3, 33.47, null, null, '7/8 TURN'),
      ('23:30'::time, 40, 15, 14.3, 48, 455.7, 450.6, 460.7, 33.86, null, null, '7/8 TURN')
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
