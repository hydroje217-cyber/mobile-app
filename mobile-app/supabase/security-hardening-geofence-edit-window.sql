-- Server-side security hardening for submitted readings.
--
-- What this does:
-- 1. Recalculates GPS distance/verification in the database instead of trusting
--    client-supplied gps_distance_m or gps_verified values.
-- 2. Rejects operator inserts/edits when GPS is missing, inaccurate, or outside
--    the site's configured geofence.
-- 3. Enforces the same 5-minute operator edit window used by the app UI.
-- 4. Prevents operators from changing immutable ownership/timing fields.
--
-- Run this in the Supabase SQL editor after schema.sql has been applied.

create or replace function public.reading_distance_meters(
  from_lat numeric,
  from_lng numeric,
  to_lat numeric,
  to_lng numeric
)
returns numeric
language sql
immutable
as $$
  select (
    6371000 * 2 * atan2(
      sqrt(
        power(sin(radians((to_lat::double precision - from_lat::double precision) / 2)), 2)
        + cos(radians(from_lat::double precision))
          * cos(radians(to_lat::double precision))
          * power(sin(radians((to_lng::double precision - from_lng::double precision) / 2)), 2)
      ),
      sqrt(
        1 - (
          power(sin(radians((to_lat::double precision - from_lat::double precision) / 2)), 2)
          + cos(radians(from_lat::double precision))
            * cos(radians(to_lat::double precision))
            * power(sin(radians((to_lng::double precision - from_lng::double precision) / 2)), 2)
        )
      )
    )
  )::numeric;
$$;

create or replace function public.is_office_role()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role(), 'operator') in ('admin', 'supervisor', 'manager', 'general_manager')
$$;

create or replace function public.enforce_reading_security()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  site_record public.sites%rowtype;
  distance_m numeric;
  radius_m numeric;
  required_accuracy_m numeric;
  office_user boolean := public.is_office_role();
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to submit or edit readings.';
  end if;

  if tg_op = 'INSERT' and new.submitted_by is distinct from auth.uid() then
    raise exception 'Readings must be submitted by the signed-in account.';
  end if;

  if tg_op = 'UPDATE' and not office_user then
    if old.submitted_by is distinct from auth.uid() then
      raise exception 'Operators can edit only their own readings.';
    end if;

    if timezone('utc', now()) > old.created_at + interval '5 minutes' then
      raise exception 'This reading is past the 5-minute edit window.';
    end if;

    if new.submitted_by is distinct from old.submitted_by
      or new.site_id is distinct from old.site_id
      or new.slot_datetime is distinct from old.slot_datetime
      or new.created_at is distinct from old.created_at
      or new.status is distinct from old.status then
      raise exception 'Operators cannot change reading ownership, slot, created time, or status.';
    end if;
  end if;

  select *
  into site_record
  from public.sites
  where id = new.site_id;

  if site_record.id is null then
    raise exception 'Reading site was not found.';
  end if;

  if site_record.latitude is null or site_record.longitude is null then
    raise exception 'This site does not have geofence coordinates configured.';
  end if;

  if new.gps_latitude is null or new.gps_longitude is null then
    if office_user then
      new.gps_verified := false;
      new.gps_distance_m := null;
      new.gps_checked_at := coalesce(new.gps_checked_at, timezone('utc', now()));
      return new;
    end if;

    raise exception 'GPS coordinates are required for operator readings.';
  end if;

  radius_m := greatest(coalesce(site_record.geofence_radius_m, 20), 1);
  required_accuracy_m := least(50, radius_m);
  distance_m := public.reading_distance_meters(
    new.gps_latitude,
    new.gps_longitude,
    site_record.latitude,
    site_record.longitude
  );

  new.gps_distance_m := distance_m;
  new.gps_verified := (
    distance_m <= radius_m
    and (
      new.gps_accuracy_m is null
      or new.gps_accuracy_m <= required_accuracy_m
    )
  );
  new.gps_checked_at := timezone('utc', now());

  if not office_user and not new.gps_verified then
    raise exception 'GPS verification failed for this site.';
  end if;

  return new;
end;
$$;

drop trigger if exists chlorination_readings_security_trigger on public.chlorination_readings;
create trigger chlorination_readings_security_trigger
before insert or update on public.chlorination_readings
for each row execute procedure public.enforce_reading_security();

drop trigger if exists deepwell_readings_security_trigger on public.deepwell_readings;
create trigger deepwell_readings_security_trigger
before insert or update on public.deepwell_readings
for each row execute procedure public.enforce_reading_security();

-- Keep RLS policies aligned with the trigger. These replace broader operator
-- update policies with policies that still allow office roles, while relying on
-- the trigger for edit-window and immutable-field enforcement.

drop policy if exists "approved users can update own chlorination readings" on public.chlorination_readings;
create policy "operators can update own recent chlorination readings"
on public.chlorination_readings
for update
using (
  (
    submitted_by = auth.uid()
    and auth.uid() is not null
    and public.is_approved_user()
    and timezone('utc', now()) <= created_at + interval '5 minutes'
  )
  or public.is_office_role()
)
with check (
  (
    submitted_by = auth.uid()
    and auth.uid() is not null
    and public.is_approved_user()
    and timezone('utc', now()) <= created_at + interval '5 minutes'
  )
  or public.is_office_role()
);

drop policy if exists "approved users can update own deepwell readings" on public.deepwell_readings;
create policy "operators can update own recent deepwell readings"
on public.deepwell_readings
for update
using (
  (
    submitted_by = auth.uid()
    and auth.uid() is not null
    and public.is_approved_user()
    and timezone('utc', now()) <= created_at + interval '5 minutes'
  )
  or public.is_office_role()
)
with check (
  (
    submitted_by = auth.uid()
    and auth.uid() is not null
    and public.is_approved_user()
    and timezone('utc', now()) <= created_at + interval '5 minutes'
  )
  or public.is_office_role()
);
