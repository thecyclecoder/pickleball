-- Coaches: 1:1 with a workspace. The coach IS the workspace owner;
-- the profile is the public-facing description users browse on /coaches
-- before requesting a private lesson. A workspace without a profile
-- simply doesn't show up on /coaches — it's still a normal workspace.
--
-- Lesson requests are inquiries — not appointments. The coach contacts
-- the requester offline to finalize timing. status tracks the loose
-- workflow: new → contacted → scheduled → completed (or cancelled).

create table public.coach_profiles (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null unique references public.workspaces(id) on delete cascade,
  slug text not null unique,
  display_name text not null,
  display_name_es text,
  tagline text,
  tagline_es text,
  bio text,
  bio_es text,
  images jsonb not null default '[]'::jsonb,
  avatar_url text,
  languages text[] not null default '{}',
  -- Lesson types this coach offers, e.g. {private, semi_private, group}
  lesson_types text[] not null default '{}',
  -- Skill levels this coach teaches, e.g. {beginner, 3.0, 3.5, 4.0}
  skill_levels text[] not null default '{}',
  price_notes text,
  price_notes_es text,
  service_area text,
  service_area_es text,
  certifications text,
  certifications_es text,
  years_coaching int check (years_coaching is null or years_coaching >= 0),
  dupr_rating numeric(2, 1),
  status text not null default 'draft' check (status in ('draft', 'published')),
  accepting_requests boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index coach_profiles_status_idx on public.coach_profiles(status);

create trigger coach_profiles_set_updated_at
before update on public.coach_profiles
for each row execute function public.set_updated_at();

create table public.lesson_requests (
  id uuid primary key default gen_random_uuid(),
  coach_profile_id uuid references public.coach_profiles(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null,
  email text not null,
  phone text,
  skill_level text not null check (
    skill_level in ('beginner', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0', '5.5', '6.0', '6.5')
  ),
  lesson_type text check (lesson_type in ('private', 'semi_private', 'group')),
  goals text,
  schedule_notes text,
  status text not null default 'new' check (
    status in ('new', 'contacted', 'scheduled', 'completed', 'cancelled')
  ),
  paid_at timestamptz,
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lesson_requests_coach_profile_id_idx on public.lesson_requests(coach_profile_id);
create index lesson_requests_workspace_id_idx on public.lesson_requests(workspace_id);
create index lesson_requests_user_id_idx on public.lesson_requests(user_id);
create index lesson_requests_email_idx on public.lesson_requests(lower(email));

create trigger lesson_requests_set_updated_at
before update on public.lesson_requests
for each row execute function public.set_updated_at();

-- ── Triggers ──────────────────────────────────────────────────────────

create or replace function public.set_lesson_request_workspace()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.workspace_id is null and new.coach_profile_id is not null then
    select workspace_id into new.workspace_id from public.coach_profiles where id = new.coach_profile_id;
  end if;
  return new;
end;
$$;

drop trigger if exists set_lesson_request_workspace on public.lesson_requests;
create trigger set_lesson_request_workspace
before insert on public.lesson_requests
for each row execute function public.set_lesson_request_workspace();

create or replace function public.link_lesson_request_on_insert()
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

drop trigger if exists link_lesson_request_on_insert on public.lesson_requests;
create trigger link_lesson_request_on_insert
before insert on public.lesson_requests
for each row execute function public.link_lesson_request_on_insert();

create or replace function public.link_lesson_requests_on_auth_user_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.lesson_requests set user_id = new.id
  where lower(email) = lower(new.email) and user_id is null;
  return new;
end;
$$;

drop trigger if exists link_lesson_requests_on_auth_user_change on auth.users;
create trigger link_lesson_requests_on_auth_user_change
after insert or update of email on auth.users
for each row execute function public.link_lesson_requests_on_auth_user_change();

create or replace function public.mark_lesson_requests_confirmed_on_sign_in()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.last_sign_in_at is not null
     and (old.last_sign_in_at is null or old.last_sign_in_at < new.last_sign_in_at)
     and new.email is not null
  then
    update public.lesson_requests
    set confirmed_at = new.last_sign_in_at
    where lower(email) = lower(new.email)
      and confirmed_at is null;
  end if;
  return new;
end;
$$;

drop trigger if exists mark_lesson_requests_confirmed_on_sign_in on auth.users;
create trigger mark_lesson_requests_confirmed_on_sign_in
after update of last_sign_in_at on auth.users
for each row execute function public.mark_lesson_requests_confirmed_on_sign_in();

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.coach_profiles enable row level security;
alter table public.lesson_requests enable row level security;

create policy "coach_profiles: public read published"
on public.coach_profiles for select
to anon, authenticated
using (status = 'published');

create policy "coach_profiles: members read all"
on public.coach_profiles for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = coach_profiles.workspace_id
      and wm.user_id = auth.uid()
  )
);

-- Lesson requests are private — only the workspace's members and the
-- requester themselves can see them. Service role (admin client) bypasses.
create policy "lesson_requests: members read"
on public.lesson_requests for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = lesson_requests.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "lesson_requests: requester self read"
on public.lesson_requests for select
to authenticated
using (user_id = auth.uid());
