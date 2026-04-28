import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";
import type { CoachProfile } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = CoachProfile & {
  workspace: { id: string; name: string; owner_email: string } | null;
};

export default async function AdminCoachesPage() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") return null;
  if (!isSuperAdmin(res.user)) redirect("/admin");

  const admin = createAdminClient();
  const { data } = await admin
    .from("coach_profiles")
    .select(`*, workspace:workspaces (id, name, owner_email)`)
    .order("updated_at", { ascending: false });
  const profiles = (data ?? []) as Row[];

  const published = profiles.filter((p) => p.status === "published").length;
  const draft = profiles.length - published;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">All coach profiles</h1>
          <p className="text-sm text-zinc-400">
            Every coach profile across every workspace. Super-admin only.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-md border border-emerald-800 bg-emerald-950/40 px-2 py-1 text-emerald-300">
            {published} published
          </span>
          <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-1 text-zinc-400">
            {draft} draft
          </span>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/40 p-10 text-center">
          <p className="text-sm text-zinc-400">No coach profiles yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-950/50 text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Coach</th>
                <th className="px-4 py-3 font-medium">Workspace</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Requests</th>
                <th className="px-4 py-3 font-medium">Updated</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-900/60">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatar_url}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-zinc-800" />
                      )}
                      <div>
                        <div className="font-medium text-white">{p.display_name}</div>
                        {p.tagline && (
                          <div className="text-xs text-zinc-500 line-clamp-1">{p.tagline}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {p.workspace?.name ?? "—"}
                    {p.workspace?.owner_email && (
                      <div className="text-xs text-zinc-500">{p.workspace.owner_email}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.status === "published"
                          ? "rounded-md border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 text-xs text-emerald-300"
                          : "rounded-md border border-zinc-700 bg-zinc-950 px-2 py-0.5 text-xs text-zinc-400"
                      }
                    >
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-zinc-300">
                    {p.accepting_requests ? (
                      <span className="text-emerald-400">Accepting</span>
                    ) : (
                      <span className="text-zinc-500">Closed</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-zinc-400">
                    {new Date(p.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/coaches/${p.id}`}
                      className="text-xs font-medium text-emerald-400 hover:text-emerald-300"
                    >
                      Edit →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
