alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('operator', 'test_operator', 'supervisor', 'manager', 'general_manager', 'admin'));

create or replace function public.assign_profile_role(target_profile_id uuid, next_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_role text := lower(trim(next_role));
  updated_profile public.profiles;
begin
  if not public.is_account_manager_user() then
    raise exception 'Only admins and general managers can assign account roles.';
  end if;

  if target_profile_id = auth.uid() and normalized_role not in ('admin', 'general_manager') then
    raise exception 'Account managers cannot remove their own account management role from the dashboard.';
  end if;

  if normalized_role not in ('operator', 'test_operator', 'supervisor', 'manager', 'general_manager', 'admin') then
    raise exception 'Invalid role.';
  end if;

  update public.profiles
  set
    role = normalized_role,
    is_active = true,
    is_approved = case
      when normalized_role = 'operator' then is_approved
      else true
    end,
    approved_at = case
      when normalized_role = 'operator' then approved_at
      else coalesce(approved_at, timezone('utc', now()))
    end,
    approved_by = case
      when normalized_role = 'operator' then approved_by
      else coalesce(approved_by, auth.uid())
    end,
    updated_at = timezone('utc', now())
  where id = target_profile_id
  returning * into updated_profile;

  if updated_profile.id is null then
    raise exception 'Profile not found.';
  end if;

  return updated_profile;
end;
$$;
