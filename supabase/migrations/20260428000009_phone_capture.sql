-- Phone number on tournament players and clinic registrations.
--
-- Captured optionally on the registration forms so we can:
--   1. Surface a "WhatsApp" deep-link button in the admin views (free,
--      Tier 1 of the WhatsApp story — already shipped for lesson
--      requests)
--   2. Send templated WhatsApp notifications for registration
--      confirmation + day-before reminders once Tier 2 lands
--
-- Nullable on both tables so existing rows aren't broken; future
-- registrations get a (still optional) phone field on the form.

alter table public.players
  add column if not exists phone text;

alter table public.clinic_registrations
  add column if not exists phone text;
