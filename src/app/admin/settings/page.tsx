import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { SettingsForm } from "./settings-form";
import { PushToggle } from "./push-toggle";
import { EmailAliasesPanel } from "./email-aliases";
import type { EmailAlias, Workspace, WorkspaceMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  const admin = createAdminClient();

  const [{ data: ws }, { data: aliasRows }, { data: memberRows }] = await Promise.all([
    admin
      .from("workspaces")
      .select("*")
      .eq("id", res.member.workspace_id)
      .single(),
    admin
      .from("email_aliases")
      .select("*")
      .eq("workspace_id", res.member.workspace_id)
      .order("created_at", { ascending: false }),
    admin
      .from("workspace_members")
      .select("email, role, user_id")
      .eq("workspace_id", res.member.workspace_id),
  ]);
  const workspace = ws as Workspace;
  const aliases = (aliasRows ?? []) as EmailAlias[];
  const members = (memberRows ?? []) as Pick<WorkspaceMember, "email" | "role" | "user_id">[];

  const memberSuggestions = members.map((m) => ({
    email: m.email,
    name: null as string | null,
  }));

  const canEdit = res.member.role === "owner" || res.member.role === "admin";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">Settings</h1>
      <div className="space-y-6">
        <SettingsForm
          workspace={workspace}
          canEdit={res.member.role !== "member"}
          isOwner={res.member.role === "owner"}
        />
        <EmailAliasesPanel aliases={aliases} members={memberSuggestions} canEdit={canEdit} />
        <PushToggle />
      </div>
    </div>
  );
}
