-- Check-in support: timestamp on players (tournament check-in) and on
-- clinic_registrations (clinic check-in). NULL means not yet checked
-- in; setting to now() flips the badge in the admin check-in list and
-- can fire a WhatsApp/email confirmation.

alter table public.players
  add column if not exists checked_in_at timestamptz;

alter table public.clinic_registrations
  add column if not exists checked_in_at timestamptz;
