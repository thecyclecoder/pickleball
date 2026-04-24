-- Player rows should live forever — deleting a team or tournament
-- must detach the player from the team, not delete the player record.
--
-- Also denormalize workspace_id onto players so the admin Players view
-- can still find a person after their team/tournament has been deleted.

-- 1) Add players.workspace_id (nullable if the workspace itself is ever
--    removed, though that's an edge case).
alter table public.players
  add column if not exists workspace_id uuid references public.workspaces(id) on delete set null;

-- Backfill from existing team → workspace relationship
update public.players p
set workspace_id = t.workspace_id
from public.teams t
where p.team_id = t.id and p.workspace_id is null;

create index if not exists players_workspace_id_idx on public.players(workspace_id);

-- Populate workspace_id from the team's workspace on insert so future rows
-- don't have to pass it explicitly.
create or replace function public.set_player_workspace()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.workspace_id is null and new.team_id is not null then
    select workspace_id into new.workspace_id from public.teams where id = new.team_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_player_workspace on public.players;
create trigger set_player_workspace
before insert on public.players
for each row execute function public.set_player_workspace();

-- 2) Detach rather than cascade when a team is deleted.
alter table public.players
  drop constraint if exists players_team_id_fkey;

alter table public.players
  alter column team_id drop not null;

alter table public.players
  add constraint players_team_id_fkey
  foreign key (team_id) references public.teams(id) on delete set null;
