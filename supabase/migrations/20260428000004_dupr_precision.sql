-- DUPR ratings have 3 decimal places (e.g. 4.763). The original
-- numeric(2,1) column only allowed 1 decimal and a max value of 9.9.
-- numeric(4,3) accepts 0.000–9.999.
alter table public.coach_profiles
  alter column dupr_rating type numeric(4, 3);
