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

  function teamAction(teamId: string, body: Record<string, unknown>) {
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

  function togglePlayerPaid(playerId: string, paid: boolean) {
    setWorking(playerId);
    startTransition(async () => {
      await fetch(`/api/admin/players/${playerId}/paid`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      router.refresh();
      setWorking(null);
    });
  }

  async function remove(teamId: string) {
    if (!confirm("Delete this team? Player records stay in the database for history.")) return;
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
                  <ul className="space-y-3">
                    {rows.map((t) => {
                      const pls = [...t.players].sort(
                        (a, b) => Number(b.is_captain) - Number(a.is_captain)
                      );
                      const teamBusy = pending && working === t.id;
                      const paidCount = pls.filter((p) => !!p.paid_at).length;
                      return (
                        <li
                          key={t.id}
                          className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
                        >
                          <header className="flex flex-wrap items-center gap-2 border-b border-zinc-800 px-3 py-2">
                            <div className="flex-1 text-xs text-zinc-400">
                              <span className="text-zinc-200">
                                {pls.map((p) => `${p.first_name} ${p.last_name}`).join(" / ")}
                              </span>
                              <span className="ml-2 text-zinc-500">
                                {paidCount} / {pls.length} paid
                              </span>
                            </div>
                            <select
                              disabled={teamBusy}
                              value={t.status}
                              onChange={(e) => teamAction(t.id, { status: e.target.value })}
                              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-white"
                              aria-label="Team status"
                            >
                              <option value="registered">Registered</option>
                              <option value="confirmed">Confirmed</option>
                              <option value="waitlisted">Waitlisted</option>
                              <option value="cancelled">Cancelled</option>
                            </select>
                            <select
                              disabled={teamBusy}
                              value={t.payment_status}
                              onChange={(e) => teamAction(t.id, { payment_status: e.target.value })}
                              className="rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1 text-xs text-white"
                              aria-label="Team payment status"
                            >
                              <option value="unpaid">Unpaid</option>
                              <option value="paid">Paid</option>
                              <option value="refunded">Refunded</option>
                            </select>
                            <button
                              type="button"
                              disabled={teamBusy}
                              onClick={() => remove(t.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              Delete team
                            </button>
                          </header>
                          <ul className="divide-y divide-zinc-800">
                            {pls.map((p) => {
                              const playerBusy = pending && working === p.id;
                              const paid = !!p.paid_at;
                              return (
                                <li
                                  key={p.id}
                                  className="flex flex-wrap items-center gap-3 px-3 py-2 text-sm"
                                >
                                  <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-2">
                                      <span className="font-medium text-white">
                                        {p.first_name} {p.last_name}
                                      </span>
                                      {p.is_captain && (
                                        <span className="rounded border border-amber-700 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-amber-400">
                                          Captain
                                        </span>
                                      )}
                                      <span className="text-xs text-zinc-500">
                                        {Number(p.rating).toFixed(1)}
                                      </span>
                                    </p>
                                    <p className="truncate text-xs text-zinc-500">{p.email}</p>
                                  </div>
                                  <label
                                    className={`flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-xs ${
                                      paid
                                        ? "border-emerald-800 bg-emerald-950/40 text-emerald-300"
                                        : "border-zinc-800 bg-zinc-900 text-zinc-300"
                                    } ${playerBusy ? "opacity-60" : ""}`}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={playerBusy}
                                      checked={paid}
                                      onChange={(e) => togglePlayerPaid(p.id, e.currentTarget.checked)}
                                      className="h-3.5 w-3.5 rounded border-zinc-700 bg-zinc-900 text-emerald-600"
                                    />
                                    {paid ? "Paid" : "Mark paid"}
                                  </label>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
