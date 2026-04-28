-- Lessons: scheduled calendar events derived from lesson_requests
-- (or created ad-hoc by the coach for someone they met at a court).
--
-- Conceptually: a lesson_request is an inquiry, a lesson is a booking.
-- Most fields are denormalized off the request so a lesson keeps its
-- meaning even if the underlying request is deleted.
--
-- Calendar story:
--   • Per-lesson ICS file via /api/lessons/<id>/ics — emailed to player
--     and linked from the admin dashboard so the coach can also drop it
--     onto their phone calendar
--   • Google Calendar deeplink built client-side from these fields

create table public.lessons (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  coach_profile_id uuid references public.coach_profiles(id) on delete set null,

  -- Source: when "Convert to lesson" is used on a lesson_request
  lesson_request_id uuid references public.lesson_requests(id) on delete set null,

  -- Player (denormalized — survives request deletion)
  user_id uuid references auth.users(id) on delete set null,
  player_first_name text not null,
  player_last_name text not null,
  player_email text not null,
  player_phone text,

  -- Schedule
  starts_at timestamptz not null,
  duration_minutes int not null default 60 check (duration_minutes > 0 and duration_minutes <= 24 * 60),
  timezone text not null default 'America/Puerto_Rico',
  location text,
  google_maps_url text,

  -- Type & pricing
  lesson_type text check (lesson_type in ('private', 'semi_private', 'group')),
  price_cents int check (price_cents is null or price_cents >= 0),

  -- Lifecycle
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'no_show')),
  paid_at timestamptz,

  -- Coach-only notes
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index lessons_workspace_id_idx on public.lessons(workspace_id);
create index lessons_user_id_idx on public.lessons(user_id);
create index lessons_starts_at_idx on public.lessons(starts_at);
create index lessons_status_idx on public.lessons(status);
create index lessons_email_idx on public.lessons(lower(player_email));

create trigger lessons_set_updated_at
before update on public.lessons
for each row execute function public.set_updated_at();

-- ── Triggers ──────────────────────────────────────────────────────────
-- Same email→user_id linking pattern as players / clinic_registrations
-- / lesson_requests so /me picks lessons up automatically.

create or replace function public.link_lesson_on_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare matched uuid;
begin
  if new.user_id is not null then return new; end if;
  select id into matched from auth.users where lower(email) = lower(new.player_email) limit 1;
  if matched is not null then new.user_id := matched; end if;
  return new;
end;
$$;

drop trigger if exists link_lesson_on_insert on public.lessons;
create trigger link_lesson_on_insert
before insert on public.lessons
for each row execute function public.link_lesson_on_insert();

create or replace function public.link_lessons_on_auth_user_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.lessons set user_id = new.id
  where lower(player_email) = lower(new.email) and user_id is null;
  return new;
end;
$$;

drop trigger if exists link_lessons_on_auth_user_change on auth.users;
create trigger link_lessons_on_auth_user_change
after insert or update of email on auth.users
for each row execute function public.link_lessons_on_auth_user_change();

-- ── RLS ───────────────────────────────────────────────────────────────
alter table public.lessons enable row level security;

create policy "lessons: members read"
on public.lessons for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = lessons.workspace_id
      and wm.user_id = auth.uid()
  )
);

create policy "lessons: player self read"
on public.lessons for select
to authenticated
using (user_id = auth.uid());
