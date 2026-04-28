-- Cap the waitlist on a clinic so that registration auto-closes once the
-- list is full. NULL = unlimited waitlist (current behavior).
alter table public.clinics
  add column if not exists waitlist_capacity int
  check (waitlist_capacity is null or waitlist_capacity >= 0);
