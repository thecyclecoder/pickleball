import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { CoachProfileForm } from "./coach-profile-form";
import { CoachShareLinks } from "./coach-share-links";
import type { CoachProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminCoachPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from("coach_profiles")
    .select("*")
    .eq("workspace_id", res.member.workspace_id)
    .maybeSingle();
  const profile = (data ?? null) as CoachProfile | null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Coach profile</h1>
        <p className="mt-1 text-sm text-zinc-400">
          The public-facing profile for this workspace. When published, it shows up on{" "}
          <span className="text-zinc-300">/coaches</span> so players can find you and request lessons.
          Lesson requests live under <span className="text-zinc-300">Lesson requests</span> in the menu.
        </p>
      </div>

      {profile && <CoachShareLinks slug={profile.slug} status={profile.status} />}

      <CoachProfileForm initial={profile} />
    </div>
  );
}
