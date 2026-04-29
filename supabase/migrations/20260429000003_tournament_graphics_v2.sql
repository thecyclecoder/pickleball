-- Pivot from AI-generated SVG to admin-uploaded template + data overlay.
--
-- Two changes:
--   1. Add 'template' as a graphic type — this is the raw image the
--      admin uploads (1080×1350 backdrop with empty data area). Unlike
--      generated variants, the SVG column is unused for 'template' rows.
--   2. Add target_key for parameterized variants. pool_result lives per
--      pool (target_key = pool_id), bracket/result lives per category
--      (target_key = category_id). Drops the prior unique(tournament,
--      type) constraint so a tournament can have N pool_result rows.

alter table public.tournament_graphics
  drop constraint if exists tournament_graphics_type_check;

alter table public.tournament_graphics
  add constraint tournament_graphics_type_check check (type in (
    'template',
    'pool_result',
    'bracket_qf',
    'bracket_sf',
    'bracket_f',
    'tournament_result',
    -- Kept for backward compatibility with the now-obsolete AI flow.
    -- Existing 'base' rows are harmless; new code writes 'template'.
    'base'
  ));

alter table public.tournament_graphics
  add column if not exists target_key text;

-- New unique index lets us have multiple pool_result rows (one per pool)
-- while still enforcing one row per (tournament, type, key). Empty
-- string covers the simple per-tournament types.
alter table public.tournament_graphics
  drop constraint if exists tournament_graphics_tournament_id_type_key;

create unique index if not exists tournament_graphics_unique_target
  on public.tournament_graphics (tournament_id, type, coalesce(target_key, ''));

-- The svg column was non-null when AI was the only source. Templates
-- are admin-uploaded PNGs/JPGs with no SVG, so relax it.
alter table public.tournament_graphics
  alter column svg drop not null;
