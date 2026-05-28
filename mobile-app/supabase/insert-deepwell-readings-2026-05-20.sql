-- Inserts/updates the May 20, 2026 Deepwell daily monitoring sheet.
-- Run this in the Supabase SQL Editor.

do $$
declare
  submitter_id uuid;
  target_site_id bigint;
  local_reading_date date := date '2026-05-20';
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
      ('00:00'::time, 40, 20, 11.8, 48, 458.7, 453.6, 464.0, 33.83, null, null, '7/8 TURN'),
      ('00:30'::time, 40, 25, 11.9, 48, 459.7, 450.1, 463.1, 33.81, null, null, '7/8 TURN'),
      ('01:00'::time, 45, 35, 10.2, 38, 475.8, 471.3, 480.0, 23.98, null, null, '3/4 TURN'),
      ('01:30'::time, 45, 35, 10.8, 38, 467.2, 473.1, 476.1, 23.09, null, null, '3/4 TURN'),
      ('02:00'::time, 45, 35, 10.3, 38, 468.7, 463.5, 471.0, 24.01, null, null, '3/4 TURN'),
      ('02:30'::time, 40, 40, 10.2, 38, 473.8, 468.5, 476.3, 24.07, null, null, '3/4 TURN'),
      ('03:00'::time, 40, 40, 10.4, 38, 471.6, 467.1, 474.9, 24.04, null, null, '3/4 TURN'),
      ('03:30'::time, 40, 40, 10.7, 38, 472.9, 467.7, 475.4, 24.02, null, null, '3/4 TURN'),
      ('04:00'::time, 50, 35, 10.9, 38, 471.1, 467.7, 470.4, 24.67, null, null, '3/4 TURN'),
      ('04:30'::time, 50, 35, 14.1, 38, 475.4, 470.3, 475.8, 24.07, null, null, '3/4 TURN'),
      ('05:00'::time, 50, 35, 14.7, 42, 474.2, 437.8, 471.9, 27.72, null, null, '3/4 TURN'),
      ('05:30'::time, 50, 35, 16.5, 42, 474.2, 465.3, 470.2, 27.67, null, null, '3/4 TURN'),
      ('06:00'::time, 50, 25, 18.5, 48, 471.0, 464.8, 471.6, 33.83, null, null, '3/4 TURN'),
      ('06:30'::time, 49, 25, 17.7, 48, 472.4, 467.4, 473.7, 33.83, null, 50861, '3/4 TURN'),
      ('07:00'::time, 40, 15, 19.9, 48, 470.9, 470.7, 478.2, 33.44, null, null, '7/8 TURN SUPMEA'),
      ('07:30'::time, 35, 10, 19.4, 48, 478.6, 473.3, 479.2, 33.52, null, null, '7/8 TURN SUPMEA'),
      ('08:00'::time, 35, 7, 21.4, 48, 471.3, 465.2, 472.0, 33.53, null, null, '7/8 TURN SUPMEA'),
      ('08:30'::time, 35, 0, 19.3, 47, 464.5, 457.8, 464.7, 32.47, null, null, '3/4 TURN SUPMEA'),
      ('09:00'::time, 35, 0, 21.0, 47, 458.1, 453.1, 460.1, 32.57, null, null, '3/4 TURN SUPMEA'),
      ('09:30'::time, 35, 0, 18.8, 47, 460.1, 455.8, 461.5, 32.53, null, null, '3/4 TURN SUPMEA'),
      ('10:00'::time, 35, null, 21.9, 47, 460.2, 456.2, 462.7, 32.54, null, null, '3/4 TURN SUPMEA'),
      ('10:30'::time, 35, null, 19.1, 47, 467.2, 457.2, 460.4, 32.58, null, null, '3/4 TURN SUPMEA'),
      ('11:00'::time, 35, null, 18.1, 47, 442.2, 436.0, 443.6, 32.57, null, null, '3/4 TURN SUPMEA'),
      ('11:30'::time, 35, null, 17.9, 47, 464.5, 416.0, 461.3, 32.24, null, null, '3/4 TURN SUPMEA'),
      ('12:00'::time, 35, null, 17.7, 47, 469.2, 463.4, 466.4, 32.51, null, null, '3/4 TURN SUPMEA'),
      ('12:30'::time, 35, null, 18.4, 47, 461.6, 458.1, 464.0, 32.63, null, null, '3/4 TURN SUPMEA'),
      ('13:00'::time, 35, null, 17.1, 47, 459.9, 455.1, 461.0, 32.65, null, null, '3/4 TURN SUPMEA'),
      ('13:30'::time, 35, 5, 17.2, 47, 453.9, 449.7, 455.1, 32.67, null, null, '3/4 TURN SUPMEA'),
      ('14:00'::time, 35, 6, 18.1, 47, 444.1, 438.6, 444.7, 32.56, null, null, '3/4 TURN SUPMEA'),
      ('14:30'::time, 35, 7, 15.7, 47, 441.3, 436.5, 442.8, 32.74, null, 50987, '3/4 TURN SUPMEA'),
      ('15:00'::time, 36, 11, 19.2, 47, 455.7, 450.0, 457.5, 32.84, null, null, '3/4 TURN'),
      ('15:30'::time, 36, 12, 18.3, 47, 458.1, 461.8, 449.3, 32.82, null, null, '3/4 TURN'),
      ('16:00'::time, 36, 12, 17.9, 47, 446.5, 439.8, 448.8, 32.66, null, null, '3/4 TURN'),
      ('16:30'::time, 35, 13, 18.7, 47, 441.2, 435.3, 462.4, 32.76, null, null, '3/4 TURN'),
      ('17:00'::time, 34, 10, 20.1, 47, 453.4, 450.9, 455.1, 32.42, null, null, '3/4 TURN'),
      ('17:30'::time, 34, 10, 18.5, 47, 460.0, 452.0, 462.2, 32.72, null, null, '3/4 TURN'),
      ('18:00'::time, 34, 9, 18.4, 47, 447.7, 441.1, 451.6, 32.65, null, null, '3/4 TURN'),
      ('18:30'::time, 34, 9, 17.5, 47, 437.6, 430.2, 444.3, 32.76, null, null, '3/4 TURN'),
      ('19:00'::time, 35, 9, 17.8, 47, 446.0, 438.9, 453.0, 32.65, null, null, '3/4 TURN'),
      ('19:30'::time, 35, 10, 17.8, 47, 447.7, 441.4, 454.2, 32.49, null, null, '3/4 TURN'),
      ('20:00'::time, 36, 10, 16.4, 47, 450.7, 443.8, 458.2, 32.84, null, null, 'Power Interruption. Resume after a minute'),
      ('20:30'::time, 32, 10, 17.4, 42, 440.1, 434.5, 440.4, 27.72, null, null, 'Power Interruption. Resume after a minute'),
      ('21:00'::time, 32, 11, 14.4, 42, 437.9, 432.0, 444.6, 27.68, null, null, 'Power Interruption. Resume after a minute'),
      ('21:30'::time, 34, 15, 11.8, 42, 436.2, 431.0, 442.1, 27.65, null, null, '3/4 TURN'),
      ('22:00'::time, 37, 19, 13.2, 42, 441.6, 436.5, 447.2, 27.66, null, null, '3/4 TURN'),
      ('22:30'::time, 40, 24, 12.8, 42, 448.9, 438.7, 449.3, 27.72, null, 51102, '3/4 TURN'),
      ('23:00'::time, 35, 25, 12.3, 38, 452.5, 447.9, 458.2, 24.01, null, null, '3/4 TURN'),
      ('23:30'::time, 35, 25, 10.3, 38, 455.5, 450.1, 460.8, 24.04, null, null, '3/4 TURN')
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
