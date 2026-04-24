-- Add Spanish translations for tournament content
alter table public.tournaments
  add column if not exists title_es text,
  add column if not exists description_es text,
  add column if not exists details_es text,
  add column if not exists location_es text,
  add column if not exists address_es text;

-- Optional Spanish label override on categories
alter table public.tournament_categories
  add column if not exists label_es text;
