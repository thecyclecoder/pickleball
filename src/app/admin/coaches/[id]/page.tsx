import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";
import { CoachProfileForm } from "@/app/admin/coach/coach-profile-form";
import type { CoachProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCoachEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  if (!isSuperAdmin(res.user)) redirect("/admin");

  const { id } = await params;
  const admin = createAdminClient();
  const { data } = await admin
    .from("coach_profiles")
    .select(`*, workspace:workspaces (id, name, owner_email)`)
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const profile = data as CoachProfile & {
    workspace: { id: string; name: string; owner_email: string } | null;
  };

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/coaches"
          className="text-xs text-zinc-500 hover:text-white"
        >
          ← All coach profiles
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          {profile.display_name}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Editing as super-admin. Workspace:{" "}
          <span className="text-zinc-300">{profile.workspace?.name ?? "—"}</span>
          {profile.workspace?.owner_email && (
            <span className="text-zinc-500"> · {profile.workspace.owner_email}</span>
          )}
        </p>
      </div>
      <CoachProfileForm
        initial={profile}
        apiEndpoint={`/api/admin/coaches/${profile.id}`}
        onDeletedHref="/admin/coaches"
      />
    </div>
  );
}
