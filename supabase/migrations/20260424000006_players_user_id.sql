-- Link tournament player rows to their auth user (by email).
-- Allows a logged-in player to view all their registrations via /me.

alter table public.players
  add column if not exists user_id uuid references auth.users(id) on delete set null;

create index if not exists players_user_id_idx on public.players(user_id);

-- Backfill existing players by email match
update public.players p
set user_id = u.id
from auth.users u
where lower(p.email) = lower(u.email)
  and p.user_id is null;

-- Link a player row to any existing auth user on insert
create or replace function public.link_player_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  matched uuid;
begin
  if new.user_id is not null then
    return new;
  end if;
  select id into matched from auth.users where lower(email) = lower(new.email) limit 1;
  if matched is not null then
    new.user_id := matched;
  end if;
  return new;
end;
$$;

drop trigger if exists link_player_on_insert on public.players;
create trigger link_player_on_insert
before insert on public.players
for each row execute function public.link_player_on_insert();

-- When a new auth user is created (or their email changes), link matching players
create or replace function public.link_players_on_auth_user_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.players set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;

drop trigger if exists link_players_on_auth_user_change on auth.users;
create trigger link_players_on_auth_user_change
after insert or update of email on auth.users
for each row execute function public.link_players_on_auth_user_change();

-- RLS: a logged-in user can read all their own player rows directly
-- (previously `players` was public-read for everyone; keep that policy and
--  add an explicit self-read too so access remains correct if we ever
--  tighten public access later).
drop policy if exists "players: self read" on public.players;
create policy "players: self read"
on public.players for select
to authenticated
using (user_id = auth.uid());
