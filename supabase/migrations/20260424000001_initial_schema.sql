-- Initial schema: workspaces, members, tournaments, categories, teams, players

-- workspaces: multi-tenant root
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_email text not null,
  payment_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- workspace_members: who can log in to /admin
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  role text not null check (role in ('owner', 'admin', 'member')),
  invited_at timestamptz not null default now(),
  joined_at timestamptz,
  unique (workspace_id, email)
);

create index workspace_members_user_id_idx on public.workspace_members(user_id);
create index workspace_members_email_idx on public.workspace_members(lower(email));

-- tournaments
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null unique,
  title text not null,
  description text,
  details text,
  flyer_image_url text,
  start_date date not null,
  end_date date,
  start_time time not null,
  timezone text not null default 'America/Puerto_Rico',
  location text not null,
  address text,
  google_maps_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'completed')),
  registration_open boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tournaments_workspace_id_idx on public.tournaments(workspace_id);
create index tournaments_status_idx on public.tournaments(status);
create index tournaments_start_date_idx on public.tournaments(start_date);

-- tournament_categories
create table public.tournament_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  type text not null check (type in ('MD', 'WD', 'MXD')),
  rating text not null,
  label text,
  team_limit integer not null default 16 check (team_limit > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tournament_id, type, rating)
);

create index tournament_categories_tournament_id_idx on public.tournament_categories(tournament_id);

-- teams
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  category_id uuid not null references public.tournament_categories(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  status text not null default 'registered' check (status in ('registered', 'confirmed', 'waitlisted', 'cancelled')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'paid', 'refunded')),
  registered_at timestamptz not null default now()
);

create index teams_tournament_id_idx on public.teams(tournament_id);
create index teams_category_id_idx on public.teams(category_id);

-- players
create table public.players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  rating numeric(2,1) not null,
  is_captain boolean not null default false,
  created_at timestamptz not null default now()
);

create index players_team_id_idx on public.players(team_id);
create index players_email_idx on public.players(lower(email));

-- updated_at trigger for tournaments
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tournaments_set_updated_at
before update on public.tournaments
for each row execute function public.set_updated_at();

-- Link a workspace_members row to auth.users on sign-in by email match
create or replace function public.link_workspace_member_on_login()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workspace_members
    set user_id = new.id,
        joined_at = coalesce(joined_at, now())
  where lower(email) = lower(new.email)
    and (user_id is null or user_id = new.id);
  return new;
end;
$$;

drop trigger if exists link_workspace_member_on_login on auth.users;
create trigger link_workspace_member_on_login
after insert or update of email on auth.users
for each row execute function public.link_workspace_member_on_login();

-- Row Level Security
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.tournaments enable row level security;
alter table public.tournament_categories enable row level security;
alter table public.teams enable row level security;
alter table public.players enable row level security;

-- workspaces: members can see theirs
create policy "workspaces: members read"
on public.workspaces for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspaces.id
      and wm.user_id = auth.uid()
  )
);

-- workspace_members: authenticated users can see their own membership row
create policy "workspace_members: self read"
on public.workspace_members for select
to authenticated
using (user_id = auth.uid());

-- tournaments: everyone can read published
create policy "tournaments: public read published"
on public.tournaments for select
to anon, authenticated
using (status = 'published');

-- Authenticated workspace members can read any tournament in their workspace (draft, etc.)
create policy "tournaments: members read all"
on public.tournaments for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = tournaments.workspace_id
      and wm.user_id = auth.uid()
  )
);

-- tournament_categories: public read
create policy "tournament_categories: public read"
on public.tournament_categories for select
to anon, authenticated
using (true);

-- teams: public read
create policy "teams: public read"
on public.teams for select
to anon, authenticated
using (true);

-- players: public read
create policy "players: public read"
on public.players for select
to anon, authenticated
using (true);

-- Note: all writes go through the service_role (admin) client, which bypasses RLS.
-- Seed: owner workspace + owner member row for dylanralston@gmail.com
insert into public.workspaces (id, name, owner_email)
values ('00000000-0000-0000-0000-000000000001', 'Puerto Rico Pickleball', 'dylanralston@gmail.com')
on conflict (id) do nothing;

insert into public.workspace_members (workspace_id, email, role)
values ('00000000-0000-0000-0000-000000000001', 'dylanralston@gmail.com', 'owner')
on conflict (workspace_id, email) do nothing;
