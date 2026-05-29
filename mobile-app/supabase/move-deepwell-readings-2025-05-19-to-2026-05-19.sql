-- Moves the May 19, 2025 Deepwell rows inserted by mistake to May 19, 2026.
-- Run this in the Supabase SQL Editor.

with target_site as (
  select id
  from public.sites
  where type = 'DEEPWELL'
  order by
    case when name = 'Main Deepwell Pump' then 0 else 1 end,
    id asc
  limit 1
),
rows_to_move as (
  select readings.id, readings.slot_datetime
  from public.deepwell_readings readings
  join target_site on target_site.id = readings.site_id
  where readings.slot_datetime >= ('2025-05-19 00:00:00'::timestamp at time zone 'Asia/Manila')
    and readings.slot_datetime < ('2025-05-20 00:00:00'::timestamp at time zone 'Asia/Manila')
)
update public.deepwell_readings readings
set
  slot_datetime = readings.slot_datetime + interval '1 year',
  reading_datetime = readings.reading_datetime + interval '1 year',
  updated_at = timezone('utc', now())
from rows_to_move
where readings.id = rows_to_move.id;
