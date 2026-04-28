-- Mirror the clinic waitlist cap on tournament categories so that
-- registration auto-closes once both the team_limit AND the waitlist
-- are full. NULL = unlimited waitlist (current behavior).
alter table public.tournament_categories
  add column if not exists waitlist_limit int
  check (waitlist_limit is null or waitlist_limit >= 0);
