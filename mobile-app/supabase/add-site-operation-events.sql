create table if not exists public.site_operation_events (
  id uuid primary key default gen_random_uuid(),
  site_id bigint not null references public.sites(id) on delete cascade,
  site_type text not null check (site_type in ('CHLORINATION', 'DEEPWELL')),
  state text not null check (state in ('shutdown', 'resumed')),
  note text not null,
  reading_id uuid,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.site_operation_events enable row level security;

drop policy if exists "approved users can read site operation events" on public.site_operation_events;
create policy "approved users can read site operation events"
on public.site_operation_events
for select
using (
  auth.uid() is not null
  and public.is_approved_user()
);

drop policy if exists "approved users can insert own site operation events" on public.site_operation_events;
create policy "approved users can insert own site operation events"
on public.site_operation_events
for insert
with check (
  created_by = auth.uid()
  and auth.uid() is not null
  and public.is_approved_user()
);

create index if not exists site_operation_events_site_created_idx
on public.site_operation_events(site_id, created_at desc);
