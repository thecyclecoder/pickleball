"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import type { PlayerAggregate } from "./page";

type Filter = "all" | "confirmed" | "pending";

export function PlayersPanel({ players }: { players: PlayerAggregate[] }) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (filter === "confirmed" && !p.has_account) return false;
      if (filter === "pending" && p.has_account) return false;
      if (!q) return true;
      return (
        p.email.includes(q) ||
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q)
      );
    });
  }, [players, search, filter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email"
          className="flex-1 min-w-[180px] rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white focus:border-emerald-600 focus:outline-none"
        />
        <div className="flex items-center gap-0.5 rounded-md border border-zinc-800 bg-zinc-900 p-0.5 text-xs">
          {(["all", "confirmed", "pending"] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-2.5 py-1 font-medium transition-colors ${
                filter === f ? "bg-emerald-600 text-white" : "text-zinc-400 hover:text-white"
              }`}
            >
              {f[0].toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-5 py-3 text-left">Player</th>
              <th className="hidden px-5 py-3 text-left md:table-cell">Email</th>
              <th className="px-5 py-3 text-left">Rating</th>
              <th className="px-5 py-3 text-left">Registrations</th>
              <th className="hidden px-5 py-3 text-left sm:table-cell">Last registered</th>
              <th className="px-5 py-3 text-left">Account</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {rows.map((p) => {
              const isOpen = expanded === p.email;
              return (
                <Fragment key={p.email}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : p.email)}
                    className="cursor-pointer hover:bg-zinc-950/60"
                  >
                    <td className="px-5 py-3 font-medium text-white">
                      {p.first_name} {p.last_name}
                    </td>
                    <td className="hidden px-5 py-3 text-zinc-400 md:table-cell">{p.email}</td>
                    <td className="px-5 py-3 text-zinc-400">{p.rating.toFixed(1)}</td>
                    <td className="px-5 py-3 text-zinc-400">{p.registration_count}</td>
                    <td className="hidden px-5 py-3 text-zinc-500 sm:table-cell">
                      {new Date(p.last_registered_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3">
                      {p.has_account ? (
                        <span className="rounded-md border border-emerald-800 bg-emerald-950/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-emerald-300">
                          Confirmed
                        </span>
                      ) : (
                        <span className="rounded-md border border-zinc-700 bg-zinc-900 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-zinc-400">
                          Pending
                        </span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-zinc-950/40">
                      <td colSpan={6} className="px-5 py-4">
                        <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500 md:hidden">
                          {p.email}
                        </p>
                        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
                          Registrations ({p.tournaments.length})
                        </p>
                        <ul className="space-y-1.5">
                          {p.tournaments.map((tr, i) => (
                            <li key={tr.id + i} className="flex items-center justify-between gap-3 text-sm">
                              <Link
                                href={`/admin/tournaments/${tr.id}`}
                                className="text-zinc-200 hover:text-emerald-400"
                              >
                                {tr.title}
                              </Link>
                              <span className="flex items-center gap-2 text-xs text-zinc-500">
                                {new Date(tr.registered_at).toLocaleDateString()}
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
                                    tr.status === "waitlisted"
                                      ? "border-amber-800 text-amber-400"
                                      : tr.status === "cancelled"
                                        ? "border-red-900 text-red-400"
                                        : "border-zinc-700 text-zinc-400"
                                  }`}
                                >
                                  {tr.status}
                                </span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-8 text-center text-sm text-zinc-500">
                  No players match your filter.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
