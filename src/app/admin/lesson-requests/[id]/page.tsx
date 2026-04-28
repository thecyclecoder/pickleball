import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";
import { LessonRequestDetail } from "./lesson-request-detail";
import type { CoachProfile, LessonRequest, LessonRequestReply } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLessonRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: request } = await admin
    .from("lesson_requests")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (!request) notFound();
  const r = request as LessonRequest;

  // Authz: super-admin sees any; otherwise must own the workspace.
  if (!isSuperAdmin(res.user) && r.workspace_id !== res.member.workspace_id) {
    notFound();
  }

  const [{ data: replies }, { data: coachRow }] = await Promise.all([
    admin
      .from("lesson_request_replies")
      .select("*")
      .eq("lesson_request_id", r.id)
      .order("created_at", { ascending: true }),
    r.coach_profile_id
      ? admin
          .from("coach_profiles")
          .select("display_name")
          .eq("id", r.coach_profile_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const coachName = (coachRow as Pick<CoachProfile, "display_name"> | null)?.display_name;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/lesson-requests"
          className="text-xs text-zinc-500 hover:text-white"
        >
          ← All lesson requests
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">
          {r.first_name} {r.last_name}
        </h1>
        <p className="mt-1 text-sm text-zinc-400">
          Requested on {new Date(r.created_at).toLocaleDateString()} ·{" "}
          <a href={`mailto:${r.email}`} className="text-zinc-300 hover:text-white">
            {r.email}
          </a>
          {r.phone && <> · {r.phone}</>}
        </p>
      </div>

      <LessonRequestDetail
        request={r}
        replies={(replies ?? []) as LessonRequestReply[]}
        coachName={coachName}
      />
    </div>
  );
}
