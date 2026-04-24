import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import type { TournamentFormat } from "@/lib/types";
import { TournamentForm } from "../tournament-form";

export const dynamic = "force-dynamic";

export default async function NewTournamentPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("tournament_formats")
    .select("*")
    .eq("workspace_id", res.member.workspace_id)
    .order("created_at", { ascending: false });
  const formats = (data ?? []) as TournamentFormat[];

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-white">New tournament</h1>
      <TournamentForm mode="create" formats={formats} />
    </div>
  );
}
