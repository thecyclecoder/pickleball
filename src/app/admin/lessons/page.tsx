import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatDuration, formatLessonWhen } from "@/lib/format";
import {
  type Lesson,
  type LessonStatus,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminLessonsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  if (res.workspaceKind !== "coach") redirect("/admin");
  const sp = await searchParams;
  const view = sp.view === "past" ? "past" : "upcoming";

  const admin = createAdminClient();
  const { data } = await admin
    .from("lessons")
    .select("*")
    .eq("workspace_id", res.member.workspace_id)
    .order("starts_at", { ascending: view === "upcoming" });
  const all = (data ?? []) as Lesson[];

  const now = new Date();
  const upcoming = all.filter((l) => new Date(l.starts_at) >= now && l.status !== "cancelled");
  const past = all.filter(
    (l) => new Date(l.starts_at) < now || l.status === "cancelled" || l.status === "completed"
  );
  const list = view === "past" ? past : upcoming;

  // Group by date label
  type Group = { label: string; rows: Lesson[] };
  const groupsMap = new Map<string, Group>();
  for (const l of list) {
    const d = new Date(l.starts_at);
    const key = d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: l.timezone,
    });
    const g = groupsMap.get(key) ?? { label: key, rows: [] };
    g.rows.push(l);
    groupsMap.set(key, g);
  }
  const groups = Array.from(groupsMap.values());

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Lessons</h1>
          <p className="text-sm text-zinc-400">
            Your scheduled lessons. Each one sends a calendar invite to the player.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
            <Link
              href="/admin/lessons"
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                view === "upcoming" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Upcoming ({upcoming.length})
            </Link>
            <Link
              href="/admin/lessons?view=past"
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                view === "past" ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              Past ({past.length})
            </Link>
          </div>
          <Link
            href="/admin/lessons/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            + New lesson
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-zinc-400">
            {view === "upcoming"
              ? "No upcoming lessons. Schedule one — or convert a lesson request from the Lesson requests menu."
              : "No past lessons yet."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.label}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                {g.label}
              </h2>
              <ul className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 divide-y divide-zinc-800">
                {g.rows.map((l) => {
                  const time = new Date(l.starts_at).toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                    timeZone: l.timezone,
                  });
                  return (
                    <li key={l.id}>
                      <Link
                        href={`/admin/lessons/${l.id}`}
                        className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm hover:bg-zinc-900/60"
                      >
                        <div className="w-20 shrink-0 text-zinc-400">{time}</div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-white">
                            {l.player_first_name} {l.player_last_name}
                          </p>
                          <p className="truncate text-xs text-zinc-500">
                            {formatDuration(l.duration_minutes)}
                            {l.location && <> · {l.location}</>}
                            {l.price_cents != null && <> · ${(l.price_cents / 100).toFixed(2)}</>}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {l.paid_at && (
                            <span className="rounded-md border border-emerald-700 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                              Paid
                            </span>
                          )}
                          <StatusBadge status={l.status} />
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: LessonStatus }) {
  const meta: Record<LessonStatus, { label: string; cls: string }> = {
    scheduled: { label: "Scheduled", cls: "border-emerald-800 bg-emerald-950/40 text-emerald-300" },
    completed: { label: "Completed", cls: "border-zinc-700 bg-zinc-900 text-zinc-300" },
    cancelled: { label: "Cancelled", cls: "border-red-900 bg-red-950/40 text-red-300" },
    no_show: { label: "No-show", cls: "border-amber-800 bg-amber-950/40 text-amber-300" },
  };
  const m = meta[status];
  return (
    <span className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${m.cls}`}>
      {m.label}
    </span>
  );
}
