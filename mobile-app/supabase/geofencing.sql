-- Adds GPS geofencing support for operator reading submissions.
-- Configure latitude/longitude per site before enforcing production use.

alter table public.sites
add column if not exists latitude numeric;

alter table public.sites
add column if not exists longitude numeric;

alter table public.sites
add column if not exists geofence_radius_m numeric not null default 20;

alter table public.sites
alter column geofence_radius_m set default 20;

do $$
begin
  if to_regclass('public.readings') is not null then
    alter table public.readings
    add column if not exists gps_latitude numeric;

    alter table public.readings
    add column if not exists gps_longitude numeric;

    alter table public.readings
    add column if not exists gps_accuracy_m numeric;

    alter table public.readings
    add column if not exists gps_distance_m numeric;

    alter table public.readings
    add column if not exists gps_verified boolean not null default false;

    alter table public.readings
    add column if not exists gps_checked_at timestamptz;
  end if;
end $$;

alter table public.chlorination_readings
add column if not exists gps_latitude numeric;

alter table public.chlorination_readings
add column if not exists gps_longitude numeric;

alter table public.chlorination_readings
add column if not exists gps_accuracy_m numeric;

alter table public.chlorination_readings
add column if not exists gps_distance_m numeric;

alter table public.chlorination_readings
add column if not exists gps_verified boolean not null default false;

alter table public.chlorination_readings
add column if not exists gps_checked_at timestamptz;

alter table public.deepwell_readings
add column if not exists gps_latitude numeric;

alter table public.deepwell_readings
add column if not exists gps_longitude numeric;

alter table public.deepwell_readings
add column if not exists gps_accuracy_m numeric;

alter table public.deepwell_readings
add column if not exists gps_distance_m numeric;

alter table public.deepwell_readings
add column if not exists gps_verified boolean not null default false;

alter table public.deepwell_readings
add column if not exists gps_checked_at timestamptz;
