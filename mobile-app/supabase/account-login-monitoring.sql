alter table public.profiles
add column if not exists last_seen_at timestamptz,
add column if not exists last_seen_user_agent text;

create index if not exists profiles_last_seen_at_idx
on public.profiles (last_seen_at desc);

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;
  end if;
end $$;

create or replace function public.update_account_presence(presence_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set
    last_seen_at = timezone('utc', now()),
    last_seen_user_agent = left(presence_user_agent, 500)
  where id = auth.uid();

  if not found then
    raise exception 'No profile found for the signed-in account.';
  end if;
end;
$$;

grant execute on function public.update_account_presence(text) to authenticated;

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
