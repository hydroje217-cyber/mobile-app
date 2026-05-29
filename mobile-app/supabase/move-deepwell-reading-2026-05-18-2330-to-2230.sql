-- Moves the mistaken May 18, 2026 2330H Deepwell power reading to 2230H.
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
target_row as (
  select readings.id
  from public.deepwell_readings readings
  join target_site on target_site.id = readings.site_id
  where readings.slot_datetime = ('2026-05-18 23:30:00'::timestamp at time zone 'Asia/Manila')
  order by readings.updated_at desc
  limit 1
)
update public.deepwell_readings readings
set
  slot_datetime = ('2026-05-18 22:30:00'::timestamp at time zone 'Asia/Manila'),
  reading_datetime = ('2026-05-18 22:30:00'::timestamp at time zone 'Asia/Manila'),
  updated_at = timezone('utc', now())
from target_row
where readings.id = target_row.id;
