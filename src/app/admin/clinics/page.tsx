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
        <ul className="space-y-2">
          {all.map((c) => {
            const active = (c.registrations ?? []).filter(
              (r: { status: string }) => r.status !== "cancelled"
            ).length;
            return (
              <li key={c.id}>
                <Link
                  href={`/admin/clinics/${c.id}`}
                  className="block rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 hover:border-zinc-700 sm:px-5 sm:py-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 text-base font-semibold text-white">
                      {c.title}
                    </p>
                    <span
                      className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider ${
                        c.status === "published"
                          ? "border-emerald-800 bg-emerald-950 text-emerald-400"
                          : c.status === "cancelled"
                            ? "border-red-900 bg-red-950 text-red-400"
                            : "border-zinc-700 bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                    <span>
                      {formatTournamentDate(c.start_date, c.end_date, c.timezone)}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="truncate">{c.location}</span>
                    <span className="text-zinc-600">·</span>
                    <span>
                      {active}
                      {c.capacity ? ` / ${c.capacity}` : ""} signup
                      {active === 1 ? "" : "s"}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
