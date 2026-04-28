import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";
import {
  clinicRatingLabel,
  lessonTypeLabel,
  type ClinicRating,
  type LessonRequest,
  type LessonRequestStatus,
  type LessonType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = LessonRequest & {
  reply_count: number;
  last_reply_at: string | null;
};

export default async function AdminLessonRequestsPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;

  const admin = createAdminClient();
  const showAll = isSuperAdmin(res.user) && res.workspaceKind !== "coach";

  // Coaches see only their workspace; super-admin browsing from a club
  // workspace can see everything (mirrors the all-coach-profiles view).
  const baseQuery = admin
    .from("lesson_requests")
    .select(`*, replies:lesson_request_replies (id, created_at, direction)`)
    .order("created_at", { ascending: false });
  const query = showAll
    ? baseQuery
    : baseQuery.eq("workspace_id", res.member.workspace_id);
  const { data } = await query;

  type Raw = LessonRequest & {
    replies: { id: string; created_at: string; direction: string }[];
  };
  const rows: Row[] = ((data ?? []) as unknown as Raw[]).map((r) => ({
    ...r,
    reply_count: r.replies?.length ?? 0,
    last_reply_at:
      r.replies && r.replies.length > 0
        ? r.replies
            .map((x) => x.created_at)
            .sort()
            .at(-1) ?? null
        : null,
  }));

  if (res.workspaceKind !== "coach" && !showAll) {
    redirect("/admin");
  }

  const pending = rows.filter((r) => r.status === "new").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Lesson requests</h1>
          <p className="text-sm text-zinc-400">
            Players who&apos;ve asked you for a lesson on your public profile.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span
            className={`rounded-md border px-2 py-1 ${
              pending > 0
                ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                : "border-zinc-700 bg-zinc-900 text-zinc-400"
            }`}
          >
            {pending} pending
          </span>
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400">
            {rows.length} total
          </span>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-zinc-400">No lesson requests yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <ul className="divide-y divide-zinc-800">
            {rows.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/lesson-requests/${r.id}`}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-zinc-900/60"
                >
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2">
                      <span className="font-medium text-white">
                        {r.first_name} {r.last_name}
                      </span>
                      <span className="text-xs text-zinc-500">
                        {clinicRatingLabel(r.skill_level as ClinicRating)}
                        {r.lesson_type && (
                          <> · {lessonTypeLabel(r.lesson_type as LessonType)}</>
                        )}
                      </span>
                    </p>
                    <p className="truncate text-xs text-zinc-500">
                      {r.email}
                      {r.phone && <> · {r.phone}</>}
                      {" · "}
                      {new Date(r.created_at).toLocaleDateString()}
                      {r.last_reply_at && (
                        <>
                          {" · last reply "}
                          {new Date(r.last_reply_at).toLocaleDateString()}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {r.reply_count > 0 && (
                      <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] uppercase tracking-wider text-zinc-400">
                        {r.reply_count} {r.reply_count === 1 ? "reply" : "replies"}
                      </span>
                    )}
                    <StatusBadge status={r.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: LessonRequestStatus }) {
  const meta: Record<LessonRequestStatus, { label: string; cls: string }> = {
    new: { label: "New", cls: "border-emerald-800 bg-emerald-950/40 text-emerald-300" },
    contacted: { label: "Contacted", cls: "border-zinc-700 bg-zinc-900 text-zinc-300" },
    scheduled: { label: "Scheduled", cls: "border-emerald-800 bg-emerald-950/40 text-emerald-300" },
    completed: { label: "Completed", cls: "border-zinc-700 bg-zinc-900 text-zinc-300" },
    cancelled: { label: "Cancelled", cls: "border-red-900 bg-red-950/40 text-red-300" },
  };
  const m = meta[status];
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}
