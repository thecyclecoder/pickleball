-- Multi-workspace support
--
-- Any user who is an "owner" of at least one workspace can create more
-- workspaces (enforced in the API). Players are global, not
-- workspace-scoped — tournaments carry workspace_id and all workspaces'
-- published tournaments are merged on the public pages.
--
-- On workspace insert, auto-add the owner_email as an "owner" member so
-- the creator immediately has access.

create or replace function public.add_owner_member_on_workspace_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.workspace_members (workspace_id, email, role)
  values (new.id, new.owner_email, 'owner')
  on conflict (workspace_id, email) do nothing;
  return new;
end;
$$;

drop trigger if exists add_owner_member_on_workspace_insert on public.workspaces;
create trigger add_owner_member_on_workspace_insert
after insert on public.workspaces
for each row execute function public.add_owner_member_on_workspace_insert();
