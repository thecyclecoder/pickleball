-- Web Push subscriptions. One row per (user, device), so the same user
-- can receive alerts on their desktop and their phone as two separate
-- endpoints.

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null,
  subscription jsonb not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, device_id)
);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);

create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

-- Users can see / manage their own subscriptions. Service-role bypasses RLS.
create policy "push_subscriptions: self read"
on public.push_subscriptions for select
to authenticated
using (user_id = auth.uid());

create policy "push_subscriptions: self write"
on public.push_subscriptions for all
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());
