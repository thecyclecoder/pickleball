"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Team, Player, TournamentCategory } from "@/lib/types";

type CategoryRow = TournamentCategory & { display: string };
type TeamWithPlayers = Team & { players: Player[] };

export function RegistrationsPanel({
  tournamentId,
  categories,
  teams,
}: {
  tournamentId: string;
  categories: CategoryRow[];
  teams: TeamWithPlayers[];
}) {
  void tournamentId;
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [working, setWorking] = useState<string | null>(null);

  function action(teamId: string, body: Record<string, unknown>) {
    setWorking(teamId);
    startTransition(async () => {
      await fetch(`/api/admin/teams/${teamId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
      setWorking(null);
    });
  }

  async function remove(teamId: string) {
    if (!confirm("Delete this team and its players? This cannot be undone.")) return;
    setWorking(teamId);
    await fetch(`/api/admin/teams/${teamId}`, { method: "DELETE" });
    router.refresh();
    setWorking(null);
  }

  const byCategory = new Map<string, TeamWithPlayers[]>();
  for (const t of teams) {
    const list = byCategory.get(t.category_id) ?? [];
    list.push(t);
    byCategory.set(t.category_id, list);
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="border-b border-zinc-800 px-5 py-3">
        <h2 className="text-sm font-semibold text-white">Registrations</h2>
      </div>
      {categories.length === 0 ? (
        <p className="px-5 py-6 text-center text-sm text-zinc-500">Add a category first.</p>
      ) : (
        <div className="divide-y divide-zinc-800">
          {categories.map((c) => {
            const rows = byCategory.get(c.id) ?? [];
            const active = rows.filter((r) => r.status !== "cancelled").length;
            return (
              <div key={c.id} className="p-5">
                <div className="mb-3 flex items-baseline justify-between">
                  <h3 className="text-sm font-semibold text-white">{c.display}</h3>
                  <span className="text-xs text-zinc-500">
                    {active} / {c.team_limit}
                  </span>
                </div>
                {rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-zinc-800 p-4 text-center text-xs text-zinc-500">
                    No teams yet.
                  </p>
                ) : (
                  <div className="overflow-hidden rounded-lg border border-zinc-800">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
                        <tr>
                          <th className="px-3 py-2 text-left">Team</th>
                          <th className="hidden px-3 py-2 text-left sm:table-cell">Emails</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Payment</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800">
                        {rows.map((t) => {
                          const pls = [...t.players].sort(
                            (a, b) => Number(b.is_captain) - Number(a.is_captain)
                          );
                          const busy = pending && working === t.id;
                          return (
                            <tr key={t.id} className="text-zinc-200">
                              <td className="px-3 py-2">
                                {pls.map((p) => `${p.first_name} ${p.last_name} (${p.rating})`).join(" / ")}
                              </td>
                              <td className="hidden px-3 py-2 text-xs text-zinc-500 sm:table-cell">
                                {pls.map((p) => p.email).join(", ")}
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  disabled={busy}
                                  value={t.status}
                                  onChange={(e) => action(t.id, { status: e.target.value })}
                                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                                >
                                  <option value="registered">Registered</option>
                                  <option value="confirmed">Confirmed</option>
                                  <option value="waitlisted">Waitlisted</option>
                                  <option value="cancelled">Cancelled</option>
                                </select>
                              </td>
                              <td className="px-3 py-2">
                                <select
                                  disabled={busy}
                                  value={t.payment_status}
                                  onChange={(e) => action(t.id, { payment_status: e.target.value })}
                                  className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-xs text-white"
                                >
                                  <option value="unpaid">Unpaid</option>
                                  <option value="paid">Paid</option>
                                  <option value="refunded">Refunded</option>
                                </select>
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  disabled={busy}
                                  onClick={() => remove(t.id)}
                                  className="text-xs text-red-400 hover:text-red-300"
                                >
                                  Delete
                                </button>
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
          })}
        </div>
      )}
    </section>
  );
}
