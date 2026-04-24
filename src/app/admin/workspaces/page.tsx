import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { WorkspacesPanel } from "./workspaces-panel";

export const dynamic = "force-dynamic";

export default async function AdminWorkspacesPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;

  const admin = createAdminClient();
  const ids = res.allMemberships.map((m) => m.workspace_id);
  const { data: workspaces } = await admin
    .from("workspaces")
    .select("id, name, owner_email, created_at")
    .in("id", ids)
    .order("created_at", { ascending: true });

  const rows = (workspaces ?? []).map((w) => {
    const member = res.allMemberships.find((m) => m.workspace_id === w.id);
    return { ...w, role: member?.role ?? "member" };
  });

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">Workspaces</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Each workspace represents an organizing group (e.g. Cocolias, El Mulo). Tournaments are scoped
        to a workspace; players are global across the whole system.
      </p>
      <WorkspacesPanel
        activeId={res.member.workspace_id}
        workspaces={rows}
        canCreate={res.canCreateWorkspace}
      />
    </div>
  );
}
