-- Replies a coach sends to a lesson requester via Buen Tiro. Going
-- through us (instead of plain email) buys two things:
--   1. Branded outbound email so the player sees a polished message
--      instead of a raw mailto reply
--   2. Status auto-flips on the lesson_request to 'contacted', so the
--      coach doesn't have to remember to update it
-- Reply-To on the outbound email is set to the coach's address, so any
-- response from the player goes straight to the coach's inbox.

create table public.lesson_request_replies (
  id uuid primary key default gen_random_uuid(),
  lesson_request_id uuid not null references public.lesson_requests(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sender_user_id uuid references auth.users(id) on delete set null,
  sender_email text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index lesson_request_replies_request_id_idx
  on public.lesson_request_replies(lesson_request_id);
create index lesson_request_replies_workspace_id_idx
  on public.lesson_request_replies(workspace_id);

alter table public.lesson_request_replies enable row level security;

create policy "lesson_request_replies: members read"
on public.lesson_request_replies for select
to authenticated
using (
  exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = lesson_request_replies.workspace_id
      and wm.user_id = auth.uid()
  )
);
