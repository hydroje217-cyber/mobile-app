-- Correction only: update the datetime fields for the May 22, 2026 deepwell rows.
-- This does not insert new readings.
-- It fixes rows that were already inserted using the left-side sheet time slots.

with target_site as (
  select id
  from public.sites
  where type = 'DEEPWELL'
    and name = 'Main Deepwell Pump'
  order by id
  limit 1
),
time_slots as (
  select (slot_local at time zone 'Asia/Manila') as slot_at
  from (
    values
      ('2026-05-22 00:00'::timestamp),
      ('2026-05-22 00:30'::timestamp),
      ('2026-05-22 01:00'::timestamp),
      ('2026-05-22 01:30'::timestamp),
      ('2026-05-22 02:00'::timestamp),
      ('2026-05-22 02:30'::timestamp),
      ('2026-05-22 03:00'::timestamp),
      ('2026-05-22 03:30'::timestamp),
      ('2026-05-22 04:00'::timestamp),
      ('2026-05-22 04:30'::timestamp),
      ('2026-05-22 05:00'::timestamp),
      ('2026-05-22 05:30'::timestamp),
      ('2026-05-22 06:00'::timestamp),
      ('2026-05-22 06:30'::timestamp)
  ) as slots(slot_local)
)
update public.deepwell_readings as readings
set
  reading_datetime = time_slots.slot_at,
  slot_datetime = time_slots.slot_at,
  created_at = time_slots.slot_at,
  updated_at = time_slots.slot_at
from target_site, time_slots
where readings.site_id = target_site.id
  and readings.slot_datetime = time_slots.slot_at;
