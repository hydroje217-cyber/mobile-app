create table if not exists public.password_reset_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz,
  reviewed_by uuid references public.profiles (id) on delete set null,
  reset_sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

alter table public.password_reset_requests
add column if not exists email text,
add column if not exists status text not null default 'pending',
add column if not exists requested_at timestamptz not null default timezone('utc', now()),
add column if not exists reviewed_at timestamptz,
add column if not exists reviewed_by uuid references public.profiles (id) on delete set null,
add column if not exists reset_sent_at timestamptz,
add column if not exists created_at timestamptz not null default timezone('utc', now()),
add column if not exists updated_at timestamptz not null default timezone('utc', now());

create index if not exists password_reset_requests_status_requested_at_idx
on public.password_reset_requests (status, requested_at desc);

drop trigger if exists password_reset_requests_set_updated_at on public.password_reset_requests;
create trigger password_reset_requests_set_updated_at
before update on public.password_reset_requests
for each row execute procedure public.set_updated_at();

alter table public.password_reset_requests enable row level security;

drop policy if exists "anyone can request password reset approval" on public.password_reset_requests;
create policy "anyone can request password reset approval"
on public.password_reset_requests
for insert
with check (status = 'pending');

drop policy if exists "account managers can read password reset requests" on public.password_reset_requests;
create policy "account managers can read password reset requests"
on public.password_reset_requests
for select
using (public.is_account_manager_user());

drop policy if exists "account managers can update password reset requests" on public.password_reset_requests;
create policy "account managers can update password reset requests"
on public.password_reset_requests
for update
using (public.is_account_manager_user())
with check (public.is_account_manager_user());

notify pgrst, 'reload schema';
