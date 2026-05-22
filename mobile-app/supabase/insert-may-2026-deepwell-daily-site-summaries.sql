with source_rows (
  site_name,
  site_type,
  summary_date,
  source,
  source_file,
  power_kwh,
  avg_tds_ppm,
  avg_upstream_pressure_psi,
  avg_downstream_pressure_psi,
  avg_vfd_frequency_hz,
  avg_voltage_l1_v,
  avg_voltage_l2_v,
  avg_voltage_l3_v,
  avg_amperage_a
) as (
  values
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-08', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 237, null, 37.63, 29.84, 42.45, 466.65, 462.62, 469.02, 28.52),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-09', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 252, null, 37.35, 24.54, 43.05, 466.19, 461.5, 467.01, 28.94),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-10', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 226, null, 37.83, 29.61, 40.08, 469.47, 465.44, 470.73, 26.07),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-11', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 132, null, 36.59, 26.52, 40.98, 640.71, 458.46, 640.67, 26.95),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-12', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 228, null, 37.54, 26.22, 41.26, 459.88, 454.23, 461.84, 27.21),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-13', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 242, null, 38.2, 32.26, 41.98, 459.41, 454.34, 462.13, 28.06),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-14', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 257, null, 35.08, 27.97, 42.75, 459.59, 455.59, 464.33, 28.51),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-15', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 266, null, 35.53, 22.03, 42.53, 446.14, 443.91, 453.1, 29.34),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-16', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 244, null, 31.26, 17.71, 43.45, 454.85, 532.18, 546.23, 29.31),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-17', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 309, null, 36.89, 25.76, 43.26, 548.38, 526.4, 547.38, 29.24),
    ('Main Deepwell Pump', 'DEEPWELL', '2026-05-18', 'manual_daily_report', 'May 2026 deepwell daily report screenshot', 353, null, 55.29, 20.19, 48.88, 455.35, 449.6, 457.22, 35.03)
),
resolved_rows as (
  select
    sites.id as site_id,
    source_rows.summary_date::date,
    source_rows.source,
    source_rows.source_file,
    source_rows.power_kwh,
    source_rows.avg_tds_ppm::numeric,
    source_rows.avg_upstream_pressure_psi,
    source_rows.avg_downstream_pressure_psi,
    source_rows.avg_vfd_frequency_hz,
    source_rows.avg_voltage_l1_v,
    source_rows.avg_voltage_l2_v,
    source_rows.avg_voltage_l3_v,
    source_rows.avg_amperage_a
  from source_rows
  join public.sites
    on sites.name = source_rows.site_name
   and sites.type = source_rows.site_type
)
insert into public.daily_site_summaries (
  site_id,
  summary_date,
  source,
  source_file,
  power_kwh,
  avg_tds_ppm,
  avg_upstream_pressure_psi,
  avg_downstream_pressure_psi,
  avg_vfd_frequency_hz,
  avg_voltage_l1_v,
  avg_voltage_l2_v,
  avg_voltage_l3_v,
  avg_amperage_a
)
select
  site_id,
  summary_date,
  source,
  source_file,
  power_kwh,
  avg_tds_ppm,
  avg_upstream_pressure_psi,
  avg_downstream_pressure_psi,
  avg_vfd_frequency_hz,
  avg_voltage_l1_v,
  avg_voltage_l2_v,
  avg_voltage_l3_v,
  avg_amperage_a
from resolved_rows
on conflict (site_id, summary_date) do update
set
  source = excluded.source,
  source_file = excluded.source_file,
  power_kwh = excluded.power_kwh,
  avg_tds_ppm = excluded.avg_tds_ppm,
  avg_upstream_pressure_psi = excluded.avg_upstream_pressure_psi,
  avg_downstream_pressure_psi = excluded.avg_downstream_pressure_psi,
  avg_vfd_frequency_hz = excluded.avg_vfd_frequency_hz,
  avg_voltage_l1_v = excluded.avg_voltage_l1_v,
  avg_voltage_l2_v = excluded.avg_voltage_l2_v,
  avg_voltage_l3_v = excluded.avg_voltage_l3_v,
  avg_amperage_a = excluded.avg_amperage_a;
