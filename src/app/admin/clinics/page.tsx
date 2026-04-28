import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership } from "@/lib/auth";
import { formatTournamentDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminClinicsPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;

  const admin = createAdminClient();
  const { data: clinics } = await admin
    .from("clinics")
    .select(
      `id, slug, title, status, start_date, end_date, timezone, location, capacity,
       registrations:clinic_registrations (id, status)`
    )
    .eq("workspace_id", res.member.workspace_id)
    .order("start_date", { ascending: false });

  const all = clinics ?? [];

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight text-white">Clinics</h1>
        <Link
          href="/admin/clinics/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
        >
          + New clinic
        </Link>
      </div>

      {all.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="mb-4 text-sm text-zinc-400">No clinics yet.</p>
          <Link
            href="/admin/clinics/new"
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
                <th className="px-5 py-3 text-left">Signups</th>
                <th className="px-5 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {all.map((c) => {
                const active = (c.registrations ?? []).filter(
                  (r: { status: string }) => r.status !== "cancelled"
                ).length;
                return (
                  <tr key={c.id} className="hover:bg-zinc-950/60">
                    <td className="px-5 py-3">
                      <Link
                        href={`/admin/clinics/${c.id}`}
                        className="font-medium text-white hover:text-emerald-400"
                      >
                        {c.title}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-zinc-400">
                      {formatTournamentDate(c.start_date, c.end_date, c.timezone)}
                    </td>
                    <td className="hidden px-5 py-3 text-zinc-400 sm:table-cell">{c.location}</td>
                    <td className="px-5 py-3 text-zinc-400">
                      {active} {c.capacity ? `/ ${c.capacity}` : ""}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                          c.status === "published"
                            ? "border-emerald-800 bg-emerald-950 text-emerald-400"
                            : c.status === "cancelled"
                              ? "border-red-900 bg-red-950 text-red-400"
                              : "border-zinc-700 bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {c.status}
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
