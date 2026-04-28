"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlayerAggregate } from "./page";

type Filter = "all" | "confirmed" | "pending";

export function PlayersPanel({
  players,
  showWorkspaceColumn,
}: {
  players: PlayerAggregate[];
  showWorkspaceColumn: boolean;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

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

  function deletePlayer(p: PlayerAggregate, ev: React.MouseEvent) {
    ev.stopPropagation();
    const confirmed = window.confirm(
      `Delete ${p.first_name} ${p.last_name} (${p.email}) from this workspace?\n\n` +
        `This removes all ${p.registration_count} registration${p.registration_count === 1 ? "" : "s"} ` +
        `and the associated teams. The person's login account (if any) is NOT deleted.`
    );
    if (!confirmed) return;
    setDeletingEmail(p.email);
    startTransition(async () => {
      const res = await fetch(`/api/admin/players?email=${encodeURIComponent(p.email)}`, {
        method: "DELETE",
      });
      setDeletingEmail(null);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        alert(body.error || "Failed to delete");
        return;
      }
      router.refresh();
    });
  }

  function exportCsv() {
    const headers = ["First name", "Last name", "Email", "Rating", "Registrations", "Confirmed", "Workspaces", "Last registered"];
    const rowsCsv = rows.map((p) =>
      [
        p.first_name,
        p.last_name,
        p.email,
        p.rating,
        String(p.registration_count),
        p.has_account ? "Yes" : "No",
        p.workspaces.map((w) => w.name).join("; "),
        p.last_registered_at?.slice(0, 10) ?? "",
      ]
        .map(escapeCsv)
        .join(",")
    );
    const csv = [headers.map(escapeCsv).join(","), ...rowsCsv].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buentiro-players-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

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
        <button
          type="button"
          onClick={exportCsv}
          className="rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2 text-xs text-zinc-200 hover:border-emerald-600 hover:text-emerald-400"
        >
          Export CSV
        </button>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
        <table className="w-full text-sm">
          <thead className="border-b border-zinc-800 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
            <tr>
              <th className="px-5 py-3 text-left">Player</th>
              <th className="hidden px-5 py-3 text-left md:table-cell">Email</th>
              <th className="px-5 py-3 text-left">Rating</th>
              <th className="px-5 py-3 text-left">Events</th>
              {showWorkspaceColumn && (
                <th className="hidden px-5 py-3 text-left lg:table-cell">Workspaces</th>
              )}
              <th className="hidden px-5 py-3 text-left sm:table-cell">Last registered</th>
              <th className="px-5 py-3 text-left">Account</th>
              <th className="px-5 py-3 text-right"></th>
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
                    <td className="px-5 py-3 text-zinc-400">{p.rating}</td>
                    <td className="px-5 py-3 text-zinc-400">{p.registration_count}</td>
                    {showWorkspaceColumn && (
                      <td className="hidden px-5 py-3 text-zinc-400 lg:table-cell">
                        {p.workspaces.map((w) => w.name).join(", ") || "—"}
                      </td>
                    )}
                    <td className="hidden px-5 py-3 text-zinc-500 sm:table-cell">
                      {p.last_registered_at ? new Date(p.last_registered_at).toLocaleDateString() : "—"}
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
                    <td className="px-5 py-3 text-right">
                      {!showWorkspaceColumn && (
                        <button
                          type="button"
                          onClick={(e) => deletePlayer(p, e)}
                          disabled={pending && deletingEmail === p.email}
                          title="Delete player from this workspace"
                          className="text-xs text-red-400 hover:text-red-300 disabled:opacity-50"
                        >
                          {pending && deletingEmail === p.email ? "Deleting…" : "Delete"}
                        </button>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-zinc-950/40">
                      <td colSpan={showWorkspaceColumn ? 8 : 7} className="px-5 py-4">
                        <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500 md:hidden">
                          {p.email}
                        </p>
                        <p className="mb-2 text-xs uppercase tracking-wider text-zinc-500">
                          Registrations ({p.events.length})
                        </p>
                        <ul className="space-y-1.5">
                          {p.events.map((ev, i) => (
                            <li key={ev.kind + ev.id + i} className="flex items-center justify-between gap-3 text-sm">
                              <Link
                                href={
                                  ev.kind === "tournament"
                                    ? `/admin/tournaments/${ev.id}`
                                    : ev.kind === "clinic"
                                      ? `/admin/clinics/${ev.id}`
                                      : "/admin/coach"
                                }
                                className="text-zinc-200 hover:text-emerald-400"
                              >
                                <span
                                  className={`mr-2 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
                                    ev.kind === "clinic"
                                      ? "border-amber-800 text-amber-400"
                                      : ev.kind === "lesson"
                                        ? "border-emerald-800 text-emerald-400"
                                        : "border-zinc-700 text-zinc-400"
                                  }`}
                                >
                                  {ev.kind}
                                </span>
                                {ev.title}
                                {showWorkspaceColumn && (
                                  <span className="ml-2 text-xs text-zinc-500">— {ev.workspace_name}</span>
                                )}
                              </Link>
                              <span className="flex items-center gap-2 text-xs text-zinc-500">
                                {new Date(ev.registered_at).toLocaleDateString()}
                                <span
                                  className={`rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wider ${
                                    ev.status === "waitlisted"
                                      ? "border-amber-800 text-amber-400"
                                      : ev.status === "cancelled"
                                        ? "border-red-900 text-red-400"
                                        : "border-zinc-700 text-zinc-400"
                                  }`}
                                >
                                  {ev.status}
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
                <td colSpan={showWorkspaceColumn ? 8 : 7} className="px-5 py-8 text-center text-sm text-zinc-500">
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

function escapeCsv(v: string): string {
  if (/[",\n]/.test(v)) {
    return `"${v.replace(/"/g, '""')}"`;
  }
  return v;
}
