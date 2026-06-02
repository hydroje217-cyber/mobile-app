alter table public.chlorination_readings
  add column if not exists operation_state text not null default 'normal',
  add column if not exists operation_note text,
  add column if not exists operation_event_at timestamptz;

alter table public.deepwell_readings
  add column if not exists operation_state text not null default 'normal',
  add column if not exists operation_note text,
  add column if not exists operation_event_at timestamptz;

alter table public.chlorination_readings
  drop constraint if exists chlorination_readings_operation_state_check;

alter table public.chlorination_readings
  add constraint chlorination_readings_operation_state_check
  check (operation_state in ('normal', 'shutdown', 'resumed'));

alter table public.deepwell_readings
  drop constraint if exists deepwell_readings_operation_state_check;

alter table public.deepwell_readings
  add constraint deepwell_readings_operation_state_check
  check (operation_state in ('normal', 'shutdown', 'resumed'));
