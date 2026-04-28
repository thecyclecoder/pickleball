-- Courts for a tournament. Tournament-level (not workspace-level) so a
-- workspace can run different events at different venues. The pool/
-- bracket generator (next phase) reads these to assign games to courts.
--
-- Per-category overrides for semifinals_court_id / finals_court_id let
-- the coach pin "the main court" for the showcase rounds; pool play and
-- earlier knockouts get round-robined across all courts by the generator.

create table public.tournament_courts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  number int not null check (number > 0),
  name text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (tournament_id, number)
);

create index tournament_courts_tournament_id_idx on public.tournament_courts(tournament_id);

alter table public.tournament_courts enable row level security;

create policy "tournament_courts: public read"
on public.tournament_courts for select
to anon, authenticated
using (true);

-- Service role bypasses RLS for writes; no INSERT/UPDATE/DELETE policy
-- needed for end users since admin writes go through createAdminClient().

-- ── Per-category overrides for showcase rounds ────────────────────────
alter table public.tournament_categories
  add column if not exists semifinals_court_id uuid references public.tournament_courts(id) on delete set null;
alter table public.tournament_categories
  add column if not exists finals_court_id uuid references public.tournament_courts(id) on delete set null;
