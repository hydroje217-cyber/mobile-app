alter table public.profiles
add column if not exists last_seen_at timestamptz;

create table if not exists public.account_login_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  email text,
  role text,
  browser text,
  device text,
  user_agent text,
  created_at timestamptz not null default timezone('utc', now())
);

alter table public.account_login_logs
add column if not exists user_id uuid references public.profiles (id) on delete set null;

alter table public.account_login_logs
add column if not exists email text;

alter table public.account_login_logs
add column if not exists role text;

alter table public.account_login_logs
add column if not exists browser text;

alter table public.account_login_logs
add column if not exists device text;

alter table public.account_login_logs
add column if not exists user_agent text;

alter table public.account_login_logs
add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists account_login_logs_created_at_idx
on public.account_login_logs (created_at desc);

create index if not exists account_login_logs_user_id_idx
on public.account_login_logs (user_id);

alter table public.account_login_logs enable row level security;

drop policy if exists "users can insert own login logs" on public.account_login_logs;
create policy "users can insert own login logs"
on public.account_login_logs
for insert
with check (auth.uid() = user_id);

drop policy if exists "account managers can read login logs" on public.account_login_logs;
create policy "account managers can read login logs"
on public.account_login_logs
for select
using (public.is_account_manager_user());
