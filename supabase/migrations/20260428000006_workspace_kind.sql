-- Workspaces fall into two camps:
--   • club  — runs tournaments + clinics; multiple coaches/staff
--   • coach — a solo coach's storefront: coach profile + clinics, no tournaments
--
-- The kind drives admin-side affordances: the menu, the dashboard's
-- primary CTA, and which APIs accept writes. Existing workspaces default
-- to 'club' (current behavior). Workspaces that already have a
-- coach_profile are reclassified as 'coach' since that's their actual
-- shape.
alter table public.workspaces
  add column if not exists kind text not null default 'club'
  check (kind in ('club', 'coach'));

update public.workspaces ws
set kind = 'coach'
where exists (select 1 from public.coach_profiles cp where cp.workspace_id = ws.id);

create index if not exists workspaces_kind_idx on public.workspaces(kind);
