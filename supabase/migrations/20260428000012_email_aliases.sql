-- Email aliases at the apex domain (e.g. dylan@buentiro.app,
-- andre@buentiro.app). Each alias is owned by a workspace and forwards
-- inbound mail to a real inbox via the inbound webhook.
--
-- Local parts are globally unique (one namespace per buentiro.app —
-- "dylan@" can only belong to one workspace at a time) and lowercased
-- in the unique index so casing doesn't cause collisions.
--
-- forward_to_email is denormalized — when an alias is created the
-- creator picks any address (often a workspace member's email, but
-- could be a generic team mailbox). Storing the literal email keeps
-- forwarding decoupled from auth user changes.

create table public.email_aliases (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  local_part text not null
    check (local_part ~ '^[a-z0-9][a-z0-9._-]*$' and length(local_part) <= 64),
  forward_to_email text not null
    check (forward_to_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  created_by_user_id uuid references auth.users(id) on delete set null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index email_aliases_local_part_idx
  on public.email_aliases(lower(local_part));
create index email_aliases_workspace_id_idx
  on public.email_aliases(workspace_id);

create trigger email_aliases_set_updated_at
before update on public.email_aliases
for each row execute function public.set_updated_at();

alter table public.email_aliases enable row level security;

create policy "email_aliases: members read"
on public.email_aliases for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = email_aliases.workspace_id
      and wm.user_id = auth.uid()
  )
);

-- Service role bypasses RLS for writes; admin client handles all CRUD.
