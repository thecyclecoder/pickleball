"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { PlayerAggregate } from "./page";

type Filter = "all" | "confirmed" | "pending";

export type EventOption = {
  key: string;
  kind: "tournament" | "clinic" | "lesson";
  id: string;
  title: string;
  workspace_name: string;
  latest_at: string;
};

export function PlayersPanel({
  players,
  showWorkspaceColumn,
  isSuperAdmin = false,
  eventOptions = [],
}: {
  players: PlayerAggregate[];
  showWorkspaceColumn: boolean;
  isSuperAdmin?: boolean;
  eventOptions?: EventOption[];
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [eventFilter, setEventFilter] = useState<string>("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return players.filter((p) => {
      if (filter === "confirmed" && !p.has_account) return false;
      if (filter === "pending" && p.has_account) return false;
      if (eventFilter && !p.events.some((e) => `${e.kind}:${e.id}` === eventFilter)) {
        return false;
      }
      if (!q) return true;
      // Non-super-admins shouldn't be able to probe by email — restrict
      // search to name fields when contact info is hidden.
      if (isSuperAdmin) {
        return (
          p.email.includes(q) ||
          (p.phone ?? "").toLowerCase().includes(q) ||
          p.first_name.toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q)
        );
      }
      return (
        p.first_name.toLowerCase().includes(q) ||
        p.last_name.toLowerCase().includes(q)
      );
    });
  }, [players, search, filter, eventFilter, isSuperAdmin]);

  // Group event options for the dropdown's optgroups.
  const groupedEvents = useMemo(() => {
    return {
      tournament: eventOptions.filter((e) => e.kind === "tournament"),
      clinic: eventOptions.filter((e) => e.kind === "clinic"),
      lesson: eventOptions.filter((e) => e.kind === "lesson"),
    };
  }, [eventOptions]);

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
    // Email and phone are super-admin-only — drop those columns for
    // workspace admins so the CSV doesn't leak contact info.
    const baseHeaders = ["First name", "Last name", "Rating", "Registrations", "Confirmed", "Workspaces", "Last registered"];
    const headers = isSuperAdmin
      ? ["First name", "Last name", "Email", "Phone", ...baseHeaders.slice(2)]
      : baseHeaders;
    const rowsCsv = rows.map((p) => {
      const cols = isSuperAdmin
        ? [
            p.first_name,
            p.last_name,
            p.email,
            p.phone ?? "",
            p.rating,
            String(p.registration_count),
            p.has_account ? "Yes" : "No",
            p.workspaces.map((w) => w.name).join("; "),
            p.last_registered_at?.slice(0, 10) ?? "",
          ]
        : [
            p.first_name,
            p.last_name,
            p.rating,
            String(p.registration_count),
            p.has_account ? "Yes" : "No",
            p.workspaces.map((w) => w.name).join("; "),
            p.last_registered_at?.slice(0, 10) ?? "",
          ];
      return cols.map(escapeCsv).join(",");
    });
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
          placeholder={isSuperAdmin ? "Search name, email, or phone" : "Search name"}
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
        {eventOptions.length > 0 && (
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="rounded-md border border-zinc-800 bg-zinc-900 px-2.5 py-2 text-xs text-zinc-200 focus:border-emerald-600 focus:outline-none"
          >
            <option value="">All events</option>
            {groupedEvents.tournament.length > 0 && (
              <optgroup label="Tournaments">
                {groupedEvents.tournament.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.title}
                    {showWorkspaceColumn ? ` — ${e.workspace_name}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {groupedEvents.clinic.length > 0 && (
              <optgroup label="Clinics">
                {groupedEvents.clinic.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.title}
                    {showWorkspaceColumn ? ` — ${e.workspace_name}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
            {groupedEvents.lesson.length > 0 && (
              <optgroup label="Lessons">
                {groupedEvents.lesson.map((e) => (
                  <option key={e.key} value={e.key}>
                    {e.title.replace(/^Lesson request — /, "")}
                    {showWorkspaceColumn ? ` — ${e.workspace_name}` : ""}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        )}
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
              {isSuperAdmin && (
                <th className="hidden px-5 py-3 text-left md:table-cell">Email</th>
              )}
              {isSuperAdmin && (
                <th className="hidden px-5 py-3 text-left lg:table-cell">Phone</th>
              )}
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
                    {isSuperAdmin && (
                      <td className="hidden px-5 py-3 text-zinc-400 md:table-cell">{p.email}</td>
                    )}
                    {isSuperAdmin && (
                      <td className="hidden px-5 py-3 text-zinc-400 lg:table-cell">
                        {p.phone ?? "—"}
                      </td>
                    )}
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
                      <div className="flex justify-end gap-3">
                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEmail(p.email);
                              setExpanded(p.email);
                            }}
                            title="Edit player details"
                            className="text-xs text-emerald-400 hover:text-emerald-300"
                          >
                            Edit
                          </button>
                        )}
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
                      </div>
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-zinc-950/40">
                      <td colSpan={7 + (isSuperAdmin ? 2 : 0) + (showWorkspaceColumn ? 1 : 0)} className="px-5 py-4">
                        {isSuperAdmin && (
                          <p className="mb-2 text-[10px] uppercase tracking-wider text-zinc-500 md:hidden">
                            {p.email}
                            {p.phone && <> · {p.phone}</>}
                          </p>
                        )}
                        {isSuperAdmin && editingEmail === p.email && (
                          <EditPlayerForm
                            player={p}
                            onClose={() => setEditingEmail(null)}
                            onSaved={() => {
                              setEditingEmail(null);
                              router.refresh();
                            }}
                          />
                        )}
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
                <td colSpan={7 + (isSuperAdmin ? 2 : 0) + (showWorkspaceColumn ? 1 : 0)} className="px-5 py-8 text-center text-sm text-zinc-500">
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

function EditPlayerForm({
  player,
  onClose,
  onSaved,
}: {
  player: PlayerAggregate;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState(player.first_name);
  const [lastName, setLastName] = useState(player.last_name);
  const [phone, setPhone] = useState("");
  // The aggregate's `rating` field can be a label like "Beginner" or a
  // numeric string. We only push numeric edits — clinic-style ratings
  // (Beginner, etc.) are stored on a different table and skipped here.
  const numericRating = /^[0-9.]+$/.test(player.rating) ? player.rating : "";
  const [rating, setRating] = useState(numericRating);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      };
      // phone: only send when changed from blank to something (we don't
      // currently render the existing phone in the row, so changes here
      // overwrite). Leaving blank in the input leaves phone untouched.
      if (phone.trim()) payload.phone = phone.trim();
      if (rating.trim()) payload.rating = Number(rating);

      const res = await fetch(
        `/api/admin/players?email=${encodeURIComponent(player.email)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to save");
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={save}
      className="mb-4 rounded-lg border border-emerald-900/60 bg-emerald-950/10 p-4"
    >
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-emerald-400">
        Edit player (super-admin) — applies across every registration tied to {player.email}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            First name
          </label>
          <input
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Last name
          </label>
          <input
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Phone (leave blank to keep current)
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+18583349198"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </div>
        <div>
          <label className="mb-1 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">
            Rating (tournament players only)
          </label>
          <input
            type="number"
            min={0}
            max={9}
            step="0.1"
            value={rating}
            onChange={(e) => setRating(e.target.value)}
            placeholder="4.0"
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-white"
          />
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:border-zinc-700"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
