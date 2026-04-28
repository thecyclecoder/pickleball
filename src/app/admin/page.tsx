import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatTournamentDate } from "@/lib/format";
import {
  clinicRatingLabel,
  lessonTypeLabel,
  type ClinicRating,
  type LessonRequestStatus,
  type LessonType,
} from "@/lib/types";

export const dynamic = "force-dynamic";

type LessonRequestRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: LessonRequestStatus;
  skill_level: ClinicRating;
  lesson_type: LessonType | null;
  created_at: string;
};

export default async function AdminDashboard() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null; // layout handles redirect/denied
  const admin = createAdminClient();

  const [
    { data: tournaments },
    { count: teamCount },
    { data: coachProfile },
  ] = await Promise.all([
    admin
      .from("tournaments")
      .select(`id, slug, title, status, start_date, end_date, timezone, teams (id, status)`)
      .eq("workspace_id", res.member.workspace_id)
      .order("start_date", { ascending: false })
      .limit(5),
    admin
      .from("teams")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", res.member.workspace_id)
      .neq("status", "cancelled"),
    admin
      .from("coach_profiles")
      .select("id, slug, display_name, status")
      .eq("workspace_id", res.member.workspace_id)
      .maybeSingle(),
  ]);

  let lessonRequests: LessonRequestRow[] = [];
  let newLessonRequestCount = 0;
  if (coachProfile) {
    const { data: lrAll } = await admin
      .from("lesson_requests")
      .select("id, first_name, last_name, email, status, skill_level, lesson_type, created_at")
      .eq("coach_profile_id", coachProfile.id)
      .order("created_at", { ascending: false });
    lessonRequests = ((lrAll ?? []) as LessonRequestRow[]).slice(0, 5);
    newLessonRequestCount = ((lrAll ?? []) as LessonRequestRow[]).filter(
      (r) => r.status === "new"
    ).length;
  }

  const all = tournaments ?? [];
  const published = all.filter((t) => t.status === "published").length;
  const drafts = all.filter((t) => t.status === "draft").length;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Dashboard</h1>
          <p className="text-sm text-zinc-400">Welcome back, {res.user.email}</p>
        </div>
        <Link
          href="/admin/tournaments/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + New tournament
        </Link>
      </div>

      <div
        className={`mb-8 grid gap-3 ${
          coachProfile ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3"
        }`}
      >
        <Stat label="Published" value={published} />
        <Stat label="Drafts" value={drafts} />
        <Stat label="Registered teams" value={teamCount ?? 0} />
        {coachProfile && (
          <Stat
            label="New lesson requests"
            value={newLessonRequestCount}
            highlight={newLessonRequestCount > 0}
          />
        )}
      </div>

      {coachProfile && (
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900">
          <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
            <h2 className="text-sm font-semibold text-white">Recent lesson requests</h2>
            <Link href="/admin/coach" className="text-xs text-emerald-500 hover:text-emerald-400">
              Manage all →
            </Link>
          </div>
          {lessonRequests.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-zinc-500">
              No lesson requests yet. They&apos;ll show up here when someone fills out the form on{" "}
              <Link
                href={`/coaches/${coachProfile.slug}`}
                className="text-emerald-500 hover:text-emerald-400"
              >
                your public profile
              </Link>
              .
            </p>
          ) : (
            <ul className="divide-y divide-zinc-800">
              {lessonRequests.map((r) => (
                <li key={r.id}>
                  <Link
                    href="/admin/coach"
                    className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-zinc-900/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2">
                        <span className="font-medium text-white">
                          {r.first_name} {r.last_name}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {clinicRatingLabel(r.skill_level)}
                          {r.lesson_type && <> · {lessonTypeLabel(r.lesson_type)}</>}
                        </span>
                      </p>
                      <p className="truncate text-xs text-zinc-500">
                        {r.email} · {new Date(r.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <LessonStatusBadge status={r.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <div className="rounded-xl border border-zinc-800 bg-zinc-900">
        <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
          <h2 className="text-sm font-semibold text-white">Recent tournaments</h2>
          <Link href="/admin/tournaments" className="text-xs text-emerald-500 hover:text-emerald-400">
            View all →
          </Link>
        </div>
        {all.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-zinc-500">
            No tournaments yet. <Link href="/admin/tournaments/new" className="text-emerald-500 hover:text-emerald-400">Create one</Link>.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {all.map((t) => {
              const active = (t.teams ?? []).filter((x: { status: string }) => x.status !== "cancelled").length;
              return (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/tournaments/${t.id}`} className="font-medium text-white hover:text-emerald-400">
                      {t.title}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {formatTournamentDate(t.start_date, t.end_date, t.timezone)} · {active} team{active === 1 ? "" : "s"}
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl border px-5 py-4 ${
        highlight
          ? "border-emerald-800 bg-emerald-950/30"
          : "border-zinc-800 bg-zinc-900"
      }`}
    >
      <p
        className={`text-xs uppercase tracking-wider ${
          highlight ? "text-emerald-400" : "text-zinc-500"
        }`}
      >
        {label}
      </p>
      <p
        className={`mt-1 text-2xl font-semibold ${
          highlight ? "text-emerald-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    published: "bg-emerald-950 text-emerald-400 border-emerald-800",
    draft: "bg-zinc-800 text-zinc-400 border-zinc-700",
    cancelled: "bg-red-950 text-red-400 border-red-900",
    completed: "bg-zinc-800 text-zinc-400 border-zinc-700",
  };
  return (
    <span
      className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
        colors[status] ?? colors.draft
      }`}
    >
      {status}
    </span>
  );
}

function LessonStatusBadge({ status }: { status: LessonRequestStatus }) {
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
