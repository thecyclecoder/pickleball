-- Pool structure lives per-category, not per-format. Formats stay general
-- (game rules for each stage); each category decides how many pools and
-- how many teams per pool are guaranteed to advance once registration
-- numbers are known.
--
-- Both fields are nullable: null means "not yet configured". Bracket
-- generation will fail with a helpful error if it's asked to run before
-- they're set.

alter table public.tournament_categories
  add column if not exists pool_count int check (pool_count is null or pool_count > 0),
  add column if not exists advance_per_pool int check (advance_per_pool is null or advance_per_pool > 0);

comment on column public.tournament_categories.advance_per_pool is
  'Minimum guaranteed advancers from each pool. If null, falls back to the format''s pool_play_advance_per_pool at bracket generation time.';
