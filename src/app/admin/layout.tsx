import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { HomeLink } from "@/components/home-link";
import { AccessDenied } from "./access-denied";
import { AdminMenu } from "./admin-menu";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const res = await getCurrentMembership();
  if (res.status === "anon") redirect("/login?next=/admin");
  if (res.status === "denied") return <AccessDenied email={res.user.email ?? undefined} />;

  const admin = createAdminClient();
  const workspaceIds = res.allMemberships.map((m) => m.workspace_id);
  const { data: wsRows } = await admin
    .from("workspaces")
    .select("id, name")
    .in("id", workspaceIds);
  const wsById = new Map((wsRows ?? []).map((w) => [w.id, w.name]));

  const switcherOptions = res.allMemberships.map((m) => ({
    id: m.workspace_id,
    name: wsById.get(m.workspace_id) ?? "Workspace",
  }));

  return (
    <div className="flex min-h-screen flex-col bg-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-2 text-white">
            <HomeLink height={24} />
            <Link
              href="/admin"
              className="hidden text-xs uppercase tracking-widest text-zinc-500 hover:text-white sm:inline"
            >
              Admin
            </Link>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 sm:gap-3">
            <WorkspaceSwitcher
              activeId={res.member.workspace_id}
              options={switcherOptions}
              canCreate={res.canCreateWorkspace}
            />
            <AdminMenu
              userEmail={res.user.email ?? null}
              isSuperAdmin={isSuperAdmin(res.user)}
              workspaceKind={res.workspaceKind}
            />
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
