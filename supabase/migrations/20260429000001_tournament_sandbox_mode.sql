-- Sandbox mode lets the workspace dry-run scoring + notifications
-- without affecting real players. When true:
--   • Live data sections (pool standings, bracket, match results) on
--     the public tournament page hide from non-workspace-members
--   • WhatsApp / email / push from the score-entry pipeline route
--     only to workspace owners + admins (with [SANDBOX] prefix in the
--     body), instead of the actual players
--   • The admin pages show a prominent SANDBOX banner so it's
--     impossible to forget to flip it off before going live

alter table public.tournaments
  add column if not exists sandbox_mode boolean not null default false;
