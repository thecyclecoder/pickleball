import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatTournamentDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminTournamentsPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;

  const admin = createAdminClient();
  const { data: tournaments } = await admin
    .from("tournaments")
    .select(
      `id, slug, title, status, start_date, end_date, timezone, location, registration_open,
       categories:tournament_categories (id, team_limit),
       teams (id, status)`
    )
    .eq("workspace_id", res.member.workspace_id)
    .order("start_date", { ascending: false });

  const all = tournaments ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">Tournaments</h1>
        <Link
          href="/admin/tournaments/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + New tournament
        </Link>
      </div>

      {all.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="mb-4 text-sm text-zinc-400">No tournaments yet.</p>
          <Link
            href="/admin/tournaments/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Create the first one
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-5 py-3 text-left">Title</th>
                <th className="px-5 py-3 text-left">Date</th>
                <th className="hidden px-5 py-3 text-left sm:table-cell">Location</th>
                <th className="px-5 py-3 text-left">Teams</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {all.map((t) => {
                const active = (t.teams ?? []).filter((x: { status: string }) => x.status !== "cancelled").length;
                const limit = (t.categories ?? []).reduce(
                  (a: number, c: { team_limit: number }) => a + c.team_limit,
                  0
                );
                return (
                  <tr key={t.id} className="hover:bg-zinc-950/60">
                    <td className="px-5 py-3">
                      <Link href={`/admin/tournaments/${t.id}`} className="font-medium text-white hover:text-emerald-400">
                        {t.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {formatTournamentDate(t.start_date, t.end_date, t.timezone)}
                    </td>
                    <td className="hidden px-5 py-3 text-zinc-400 sm:table-cell">{t.location}</td>
                    <td className="px-5 py-3 text-zinc-400">
                      {active} {limit ? `/ ${limit}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          t.status === "published"
                            ? "border-emerald-800 bg-emerald-950 text-emerald-400"
                            : t.status === "cancelled"
                              ? "border-red-900 bg-red-950 text-red-400"
                              : "border-zinc-700 bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {t.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
