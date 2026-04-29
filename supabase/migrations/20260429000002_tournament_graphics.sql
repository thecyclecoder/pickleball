-- AI-generated graphic templates for tournament announcements.
--
-- One row per (tournament, type). Type starts with 'base' (the visual
-- shell that establishes design language) and will expand to the five
-- application variants (pool_result, bracket_qf/sf/f, tournament_result)
-- in v2. Each row holds:
--   • svg          — the source SVG returned by Sonnet
--   • png_url      — Supabase Storage URL of the rasterized 1080x1350 PNG
--   • approved     — admin-flipped flag; auto-generation in v2 only fires
--                    for approved templates
--   • feedback_history — append-only list of {ts, prompt} for each
--                    regenerate-with-feedback iteration, so the LLM can
--                    see prior critiques on the next pass

create table public.tournament_graphics (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments(id) on delete cascade,
  type text not null check (type in (
    'base',
    'pool_result',
    'bracket_qf',
    'bracket_sf',
    'bracket_f',
    'tournament_result'
  )),
  svg text not null,
  png_url text,
  approved boolean not null default false,
  feedback_history jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, type)
);

create index tournament_graphics_tournament_id_idx
  on public.tournament_graphics(tournament_id);

create trigger tournament_graphics_set_updated_at
before update on public.tournament_graphics
for each row execute function public.set_updated_at();

alter table public.tournament_graphics enable row level security;

-- Public read (graphics are meant to be shared); service_role for writes.
create policy "tournament_graphics: public read"
on public.tournament_graphics for select
to anon, authenticated
using (true);
