-- "Confirmed" should mean the person has actually signed in at least once,
-- not just "an auth user row exists" (which we now create pre-emptively so
-- magic links always issue type=magiclink instead of type=signup).
--
-- Add players.confirmed_at, set by a trigger on auth.users.last_sign_in_at.

alter table public.players
  add column if not exists confirmed_at timestamptz;

create index if not exists players_confirmed_at_idx on public.players(confirmed_at);

create or replace function public.mark_players_confirmed_on_sign_in()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.last_sign_in_at is not null
     and (old.last_sign_in_at is null or old.last_sign_in_at < new.last_sign_in_at)
     and new.email is not null
  then
    update public.players
    set confirmed_at = new.last_sign_in_at
    where lower(email) = lower(new.email)
      and confirmed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists mark_players_confirmed_on_sign_in on auth.users;
create trigger mark_players_confirmed_on_sign_in
after update of last_sign_in_at on auth.users
for each row execute function public.mark_players_confirmed_on_sign_in();

-- Backfill: anyone who has signed in before now
update public.players p
set confirmed_at = u.last_sign_in_at
from auth.users u
where lower(p.email) = lower(u.email)
  and u.last_sign_in_at is not null
  and p.confirmed_at is null;
