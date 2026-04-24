import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatTournamentDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null; // layout handles redirect/denied
  const admin = createAdminClient();

  const [{ data: tournaments }, { count: teamCount }] = await Promise.all([
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
  ]);

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

      <div className="mb-8 grid gap-3 sm:grid-cols-3">
        <Stat label="Published" value={published} />
        <Stat label="Drafts" value={drafts} />
        <Stat label="Registered teams" value={teamCount ?? 0} />
      </div>

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

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 px-5 py-4">
      <p className="text-xs uppercase tracking-wider text-zinc-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
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
