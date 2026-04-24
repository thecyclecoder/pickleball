-- Tournament formats: reusable templates for pool-play + elimination-bracket
-- rules. A format belongs to one workspace. A tournament_category can
-- reference one format; different categories in the same tournament can
-- use different formats.

create table public.tournament_formats (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  description text,

  -- Pool play (round-robin within each pool)
  pool_play_games_to int not null default 11,
  pool_play_win_by int not null default 2,
  pool_play_best_of int not null default 1,
  pool_play_advance_per_pool int not null default 2,

  -- Elimination stages — each stage is optional. Standard setup:
  --   QF off, SF on to 15, F best-of-3 to 11.
  has_quarterfinals boolean not null default false,
  quarterfinals_games_to int,
  quarterfinals_win_by int,
  quarterfinals_best_of int,

  has_semifinals boolean not null default true,
  semifinals_games_to int default 15,
  semifinals_win_by int default 2,
  semifinals_best_of int default 1,

  has_finals boolean not null default true,
  finals_games_to int default 11,
  finals_win_by int default 2,
  finals_best_of int default 3,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tournament_formats_workspace_id_idx on public.tournament_formats(workspace_id);

create trigger tournament_formats_set_updated_at
before update on public.tournament_formats
for each row execute function public.set_updated_at();

-- RLS: public read (formats are essentially metadata, shown on tournament pages)
alter table public.tournament_formats enable row level security;

create policy "tournament_formats: public read"
on public.tournament_formats for select
to anon, authenticated
using (true);

-- Attach a format to each category. Nullable: if no format is selected,
-- the category's tournament has no structured rules defined yet.
alter table public.tournament_categories
  add column if not exists format_id uuid references public.tournament_formats(id) on delete set null;

create index if not exists tournament_categories_format_id_idx on public.tournament_categories(format_id);
