import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { SettingsForm } from "./settings-form";
import { PushToggle } from "./push-toggle";
import type { Workspace } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  const admin = createAdminClient();

  const { data } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", res.member.workspace_id)
    .single();
  const workspace = data as Workspace;

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">Settings</h1>
      <div className="space-y-6">
        <SettingsForm workspace={workspace} canEdit={res.member.role !== "member"} />
        <PushToggle />
      </div>
    </div>
  );
}
