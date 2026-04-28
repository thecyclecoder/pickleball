-- Clinics: like tournaments but participants register individually
-- (not in pairs), there's no bracket / pool play, and there's a list
-- of coaches per clinic. Self-reported skill level + age captured at
-- registration so the coach can plan groupings.

create table public.clinics (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  slug text not null unique,
  title text not null,
  title_es text,
  description text,
  description_es text,
  details text,
  details_es text,
  flyer_image_url text,
  images jsonb not null default '[]'::jsonb,
  start_date date not null,
  end_date date,
  start_time time not null,
  timezone text not null default 'America/Puerto_Rico',
  location text not null,
  location_es text,
  address text,
  address_es text,
  google_maps_url text,
  status text not null default 'draft' check (status in ('draft', 'published', 'cancelled', 'completed')),
  registration_open boolean not null default true,
  capacity int check (capacity is null or capacity > 0),
  payment_qr_url text,
  payment_instructions text,
  payment_instructions_es text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index clinics_workspace_id_idx on public.clinics(workspace_id);
create index clinics_status_idx on public.clinics(status);
create index clinics_start_date_idx on public.clinics(start_date);

create trigger clinics_set_updated_at
before update on public.clinics
for each row execute function public.set_updated_at();

-- Coaches: per-clinic embedded records (a coach who shows up across many
-- clinics is duplicated; can be normalized later if recurrence becomes
-- common).
create table public.clinic_coaches (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  name text not null,
  title text,
  image_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create index clinic_coaches_clinic_id_idx on public.clinic_coaches(clinic_id);

-- Individual registrations.
create table public.clinic_registrations (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  rating_self text not null check (
    rating_self in ('beginner', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0', '6.5')
  ),
  age int not null check (age > 0),
  status text not null default 'registered' check (status in ('registered', 'waitlisted', 'cancelled')),
  paid_at timestamptz,
  confirmed_at timestamptz,
  registered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index clinic_registrations_clinic_id_idx on public.clinic_registrations(clinic_id);
create index clinic_registrations_workspace_id_idx on public.clinic_registrations(workspace_id);
create index clinic_registrations_user_id_idx on public.clinic_registrations(user_id);
create index clinic_registrations_email_idx on public.clinic_registrations(lower(email));

-- ── Triggers ──────────────────────────────────────────────────────────

-- Copy workspace_id from the clinic row on insert (so admin queries can
-- filter by workspace_id directly even after a clinic is deleted).
create or replace function public.set_clinic_registration_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.workspace_id is null and new.clinic_id is not null then
    select workspace_id into new.workspace_id from public.clinics where id = new.clinic_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_clinic_registration_workspace on public.clinic_registrations;
create trigger set_clinic_registration_workspace
before insert on public.clinic_registrations
for each row execute function public.set_clinic_registration_workspace();

-- Auto-link to existing auth user by email on insert.
create or replace function public.link_clinic_registration_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  matched uuid;
begin
  if new.user_id is not null then
    return new;
  end if;
  select id into matched from auth.users where lower(email) = lower(new.email) limit 1;
  if matched is not null then
    new.user_id := matched;
  end if;
  return new;
end;
$$;

drop trigger if exists link_clinic_registration_on_insert on public.clinic_registrations;
create trigger link_clinic_registration_on_insert
before insert on public.clinic_registrations
for each row execute function public.link_clinic_registration_on_insert();

-- When an auth user is created or their email changes, link any matching
-- clinic_registrations rows. (Mirrors what we do for players.)
create or replace function public.link_clinic_registrations_on_auth_user_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.clinic_registrations set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;

drop trigger if exists link_clinic_registrations_on_auth_user_change on auth.users;
create trigger link_clinic_registrations_on_auth_user_change
after insert or update of email on auth.users
for each row execute function public.link_clinic_registrations_on_auth_user_change();

-- Mark confirmed_at on sign-in.
create or replace function public.mark_clinic_registrations_confirmed_on_sign_in()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is not null
     and (old.last_sign_in_at is null or old.last_sign_in_at < new.last_sign_in_at)
     and new.email is not null
  then
    update public.clinic_registrations
    set confirmed_at = new.last_sign_in_at
    where lower(email) = lower(new.email)
      and confirmed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists mark_clinic_registrations_confirmed_on_sign_in on auth.users;
create trigger mark_clinic_registrations_confirmed_on_sign_in
after update of last_sign_in_at on auth.users
for each row execute function public.mark_clinic_registrations_confirmed_on_sign_in();

-- Backfill confirmed_at + user_id for any existing rows whose email
-- already matches an auth user (no-op for fresh deploy).
update public.clinic_registrations cr
set user_id = u.id, confirmed_at = coalesce(cr.confirmed_at, u.last_sign_in_at)
from auth.users u
where lower(cr.email) = lower(u.email) and cr.user_id is null;

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.clinics enable row level security;
alter table public.clinic_coaches enable row level security;
alter table public.clinic_registrations enable row level security;

-- Clinics: public can read published; workspace members can read all
create policy "clinics: public read published"
on public.clinics for select
to anon, authenticated
using (status = 'published');

create policy "clinics: members read all"
on public.clinics for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = clinics.workspace_id
      and wm.user_id = auth.uid()
  )
);

-- Coaches + registrations: public read (consistent with players precedent)
create policy "clinic_coaches: public read"
on public.clinic_coaches for select
to anon, authenticated
using (true);

create policy "clinic_registrations: public read"
on public.clinic_registrations for select
to anon, authenticated
using (true);

-- A signed-in user can read their own registrations directly (parity with
-- players self-read).
create policy "clinic_registrations: self read"
on public.clinic_registrations for select
to authenticated
using (user_id = auth.uid());
