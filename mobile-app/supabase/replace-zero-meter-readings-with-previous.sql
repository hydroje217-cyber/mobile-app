-- Replace zero meter readings with the latest previous non-zero value for the same site.
--
-- Review the "preview" result sets first. Run the transaction block only when the
-- previewed replacements look correct.

-- Preview chlorination totalizer replacements.
select
  readings.id,
  readings.site_id,
  readings.slot_datetime,
  readings.totalizer as current_totalizer,
  previous_reading.totalizer as replacement_totalizer,
  previous_reading.slot_datetime as replacement_source_slot
from public.chlorination_readings readings
join lateral (
  select previous.totalizer, previous.slot_datetime
  from public.chlorination_readings previous
  where previous.site_id = readings.site_id
    and previous.slot_datetime < readings.slot_datetime
    and previous.totalizer is not null
    and previous.totalizer <> 0
  order by previous.slot_datetime desc
  limit 1
) previous_reading on true
where readings.totalizer = 0
order by readings.site_id, readings.slot_datetime;

-- Preview chlorination power replacements.
select
  readings.id,
  readings.site_id,
  readings.slot_datetime,
  readings.chlorination_power_kwh as current_chlorination_power_kwh,
  previous_reading.chlorination_power_kwh as replacement_chlorination_power_kwh,
  previous_reading.slot_datetime as replacement_source_slot
from public.chlorination_readings readings
join lateral (
  select previous.chlorination_power_kwh, previous.slot_datetime
  from public.chlorination_readings previous
  where previous.site_id = readings.site_id
    and previous.slot_datetime < readings.slot_datetime
    and previous.chlorination_power_kwh is not null
    and previous.chlorination_power_kwh <> 0
  order by previous.slot_datetime desc
  limit 1
) previous_reading on true
where readings.chlorination_power_kwh = 0
order by readings.site_id, readings.slot_datetime;

-- Preview deepwell power replacements.
select
  readings.id,
  readings.site_id,
  readings.slot_datetime,
  readings.power_kwh_shift as current_power_kwh_shift,
  previous_reading.power_kwh_shift as replacement_power_kwh_shift,
  previous_reading.slot_datetime as replacement_source_slot
from public.deepwell_readings readings
join lateral (
  select previous.power_kwh_shift, previous.slot_datetime
  from public.deepwell_readings previous
  where previous.site_id = readings.site_id
    and previous.slot_datetime < readings.slot_datetime
    and previous.power_kwh_shift is not null
    and previous.power_kwh_shift <> 0
  order by previous.slot_datetime desc
  limit 1
) previous_reading on true
where readings.power_kwh_shift = 0
order by readings.site_id, readings.slot_datetime;

begin;

with replacements as (
  select
    readings.id,
    previous_reading.totalizer as replacement_totalizer
  from public.chlorination_readings readings
  join lateral (
    select previous.totalizer
    from public.chlorination_readings previous
    where previous.site_id = readings.site_id
      and previous.slot_datetime < readings.slot_datetime
      and previous.totalizer is not null
      and previous.totalizer <> 0
    order by previous.slot_datetime desc
    limit 1
  ) previous_reading on true
  where readings.totalizer = 0
)
update public.chlorination_readings readings
set totalizer = replacements.replacement_totalizer
from replacements
where readings.id = replacements.id;

with replacements as (
  select
    readings.id,
    previous_reading.chlorination_power_kwh as replacement_chlorination_power_kwh
  from public.chlorination_readings readings
  join lateral (
    select previous.chlorination_power_kwh
    from public.chlorination_readings previous
    where previous.site_id = readings.site_id
      and previous.slot_datetime < readings.slot_datetime
      and previous.chlorination_power_kwh is not null
      and previous.chlorination_power_kwh <> 0
    order by previous.slot_datetime desc
    limit 1
  ) previous_reading on true
  where readings.chlorination_power_kwh = 0
)
update public.chlorination_readings readings
set chlorination_power_kwh = replacements.replacement_chlorination_power_kwh
from replacements
where readings.id = replacements.id;

with replacements as (
  select
    readings.id,
    previous_reading.power_kwh_shift as replacement_power_kwh_shift
  from public.deepwell_readings readings
  join lateral (
    select previous.power_kwh_shift
    from public.deepwell_readings previous
    where previous.site_id = readings.site_id
      and previous.slot_datetime < readings.slot_datetime
      and previous.power_kwh_shift is not null
      and previous.power_kwh_shift <> 0
    order by previous.slot_datetime desc
    limit 1
  ) previous_reading on true
  where readings.power_kwh_shift = 0
)
update public.deepwell_readings readings
set power_kwh_shift = replacements.replacement_power_kwh_shift
from replacements
where readings.id = replacements.id;

commit;
