import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { MembersPanel } from "./members-panel";
import type { WorkspaceMember } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminMembersPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", res.member.workspace_id)
    .order("invited_at", { ascending: true });

  const members = (data ?? []) as WorkspaceMember[];
  const canManage = res.member.role === "owner" || res.member.role === "admin";

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-white">Members</h1>
      <p className="mb-6 text-sm text-zinc-400">
        Invite people to manage tournaments. Share the generated link — they&apos;ll sign in with Google
        using the invited email.
      </p>
      <MembersPanel
        members={members}
        canManage={canManage}
        currentMemberId={res.member.id}
      />
    </div>
  );
}
