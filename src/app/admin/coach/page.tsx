import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { CoachProfileForm } from "./coach-profile-form";
import { CoachShareLinks } from "./coach-share-links";
import { LessonRequestsPanel } from "./lesson-requests-panel";
import type { CoachProfile, LessonRequest } from "@/lib/types";

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

  let requests: LessonRequest[] = [];
  if (profile) {
    const { data: reqs } = await admin
      .from("lesson_requests")
      .select("*")
      .eq("coach_profile_id", profile.id)
      .order("created_at", { ascending: false });
    requests = (reqs ?? []) as LessonRequest[];
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Coach profile</h1>
        <p className="mt-1 text-sm text-zinc-400">
          The public-facing profile for this workspace. When published, it shows up on{" "}
          <span className="text-zinc-300">/coaches</span> so players can find you and request lessons.
          Skip this if your workspace only runs tournaments and clinics.
        </p>
      </div>

      {profile && <CoachShareLinks slug={profile.slug} status={profile.status} />}

      {profile && <LessonRequestsPanel requests={requests} />}

      <CoachProfileForm initial={profile} />
    </div>
  );
}
