-- Inserts/updates the May 18, 2026 2330H Deepwell power reading.
-- Run this in the Supabase SQL Editor.

do $$
declare
  submitter_id uuid;
  target_site_id bigint;
  local_slot_at timestamptz := ('2026-05-18 23:30:00'::timestamp at time zone 'Asia/Manila');
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

  insert into public.deepwell_readings (
    site_id,
    submitted_by,
    reading_datetime,
    slot_datetime,
    status,
    remarks,
    power_kwh_shift
  )
  values (
    target_site_id,
    submitter_id,
    local_slot_at,
    local_slot_at,
    'submitted',
    'Power reading seed',
    50348
  )
  on conflict (site_id, slot_datetime)
  do update set
    submitted_by = excluded.submitted_by,
    reading_datetime = excluded.reading_datetime,
    status = excluded.status,
    remarks = excluded.remarks,
    power_kwh_shift = excluded.power_kwh_shift,
    updated_at = timezone('utc', now());
end $$;
