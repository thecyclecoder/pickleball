import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { SignOutButton } from "./sign-out-button";
import { WorkspaceSwitcher } from "./workspace-switcher";
import { Logo } from "@/components/logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const res = await getCurrentMembership();
  if (res.status === "anon") redirect("/login?next=/admin");
  // Signed in but not a workspace member → they're just a regular player;
  // silently route them to their profile.
  if (res.status === "denied") redirect("/me");

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
          <div className="flex items-center gap-4 sm:gap-6">
            <Link href="/admin" aria-label="Buen Tiro" className="flex items-center gap-2 text-white">
              <Logo height={24} />
              <span className="hidden text-xs uppercase tracking-widest text-zinc-500 sm:inline">Admin</span>
            </Link>
            <nav className="hidden gap-5 text-sm text-zinc-400 sm:flex">
              <Link href="/admin" className="hover:text-white">Dashboard</Link>
              <Link href="/admin/tournaments" className="hover:text-white">Tournaments</Link>
              <Link href="/admin/formats" className="hover:text-white">Formats</Link>
              <Link href="/admin/players" className="hover:text-white">Players</Link>
              <Link href="/admin/members" className="hover:text-white">Members</Link>
              <Link href="/admin/workspaces" className="hover:text-white">Workspaces</Link>
              <Link href="/admin/settings" className="hover:text-white">Settings</Link>
            </nav>
          </div>
          <div className="flex items-center gap-2 text-xs text-zinc-500 sm:gap-3">
            <WorkspaceSwitcher
              activeId={res.member.workspace_id}
              options={switcherOptions}
              canCreate={res.canCreateWorkspace}
            />
            <span className="hidden truncate sm:inline">{res.user.email}</span>
            <SignOutButton />
          </div>
        </div>
        <nav className="flex gap-4 overflow-x-auto border-t border-zinc-900 px-4 py-2 text-xs text-zinc-400 sm:hidden">
          <Link href="/admin">Dashboard</Link>
          <Link href="/admin/tournaments">Tournaments</Link>
          <Link href="/admin/formats">Formats</Link>
          <Link href="/admin/players">Players</Link>
          <Link href="/admin/members">Members</Link>
          <Link href="/admin/workspaces">Workspaces</Link>
          <Link href="/admin/settings">Settings</Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}
