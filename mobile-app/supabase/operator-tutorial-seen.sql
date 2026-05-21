alter table public.profiles
add column if not exists operator_tutorial_seen boolean not null default false;
