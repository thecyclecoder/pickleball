import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { LessonForm } from "../lesson-form";
import type { LessonRequest, LessonType } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLessonNewPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  if (res.workspaceKind !== "coach") redirect("/admin");

  const sp = await searchParams;
  const fromRequestId = sp.from ?? null;

  // Pre-fill from a lesson request if specified
  let initial: Partial<LessonRequest> & { lesson_request_id?: string } = {};
  if (fromRequestId) {
    const admin = createAdminClient();
    const { data: req } = await admin
      .from("lesson_requests")
      .select("*")
      .eq("id", fromRequestId)
      .eq("workspace_id", res.member.workspace_id)
      .maybeSingle();
    if (req) {
      initial = {
        first_name: req.first_name,
        last_name: req.last_name,
        email: req.email,
        phone: req.phone,
        lesson_type: req.lesson_type as LessonType | null,
      };
    }
  }

  return (
    <div>
      <div className="mb-6">
        <Link href="/admin/lessons" className="text-xs text-zinc-500 hover:text-white">
          ← All lessons
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">Schedule a lesson</h1>
        {fromRequestId && (
          <p className="mt-1 text-sm text-zinc-400">
            Pre-filled from a lesson request — the request will be marked{" "}
            <span className="text-zinc-300">scheduled</span> when you save.
          </p>
        )}
      </div>
      <LessonForm
        mode="create"
        initial={{
          player_first_name: initial.first_name ?? "",
          player_last_name: initial.last_name ?? "",
          player_email: initial.email ?? "",
          player_phone: initial.phone ?? "",
          lesson_type: initial.lesson_type ?? null,
          timezone: "America/Puerto_Rico",
          duration_minutes: 60,
        }}
        conversionFromRequestId={fromRequestId}
      />
    </div>
  );
}
