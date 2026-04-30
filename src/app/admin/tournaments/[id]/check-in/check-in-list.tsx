"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type CheckInPlayer = {
  id: string;
  team_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  checked_in_at: string | null;
  partner_label: string;
  pool_letter: string | null;
  category_label: string;
  team_paid: boolean;
  team_payment_status: string;
};

export function CheckInList({
  tournamentId,
  initialPlayers,
}: {
  tournamentId: string;
  initialPlayers: CheckInPlayer[];
}) {
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [players, setPlayers] = useState<CheckInPlayer[]>(initialPlayers);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      `${p.first_name} ${p.last_name} ${p.email}`.toLowerCase().includes(q)
    );
  }, [search, players]);

  const checkedCount = players.filter((p) => p.checked_in_at).length;
  const open = openId ? players.find((p) => p.id === openId) ?? null : null;

  function applyOptimistic(updated: CheckInPlayer) {
    setPlayers((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
  }

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-zinc-950 px-4 pb-3 sm:-mx-6 sm:px-6">
        <div className="mb-2 flex items-baseline justify-between">
          <p className="text-xs text-zinc-400">
            <span className="text-emerald-400">{checkedCount}</span> / {players.length}{" "}
            checked in
          </p>
        </div>
        <input
          type="search"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
        />
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 && (
          <li className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
            {search ? "No matches." : "No players registered."}
          </li>
        )}
        {filtered.map((p) => {
          const checkedIn = !!p.checked_in_at;
          return (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setOpenId(p.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left ${
                  checkedIn
                    ? "border-emerald-900/60 bg-emerald-950/20"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {p.first_name} {p.last_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-400">
                    {p.partner_label !== "—" && <>w/ {p.partner_label}</>}
                    {p.pool_letter && (
                      <span className="ml-1 text-zinc-500">· Pool {p.pool_letter}</span>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {checkedIn ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      ✓ In
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                      Tap to check in
                    </span>
                  )}
                  <div className="flex gap-1">
                    {!p.team_paid && (
                      <span className="rounded bg-amber-950/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
                        Unpaid
                      </span>
                    )}
                    {!p.phone && (
                      <span className="rounded bg-red-950/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-red-300">
                        No phone
                      </span>
                    )}
                  </div>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      {open && (
        <CheckInDrawer
          tournamentId={tournamentId}
          player={open}
          onClose={() => setOpenId(null)}
          onUpdated={(updated) => {
            applyOptimistic(updated);
            // Refresh server data so other tabs/admins stay in sync.
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function CheckInDrawer({
  tournamentId,
  player,
  onClose,
  onUpdated,
}: {
  tournamentId: string;
  player: CheckInPlayer;
  onClose: () => void;
  onUpdated: (p: CheckInPlayer) => void;
}) {
  const [phone, setPhone] = useState(player.phone ?? "");
  const [busy, setBusy] = useState<"in" | "out" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<{
    pool: string | null;
    partner: string;
    notify?: { delivered: number; sandbox: boolean } | null;
  } | null>(null);

  async function checkIn() {
    setError(null);
    setBusy("in");
    const body: Record<string, string> = {};
    if (phone.trim() && phone.trim() !== player.phone) body.phone = phone.trim();
    const res = await fetch(
      `/api/admin/tournaments/${tournamentId}/check-in/${player.id}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Check-in failed");
      setBusy(null);
      return;
    }
    onUpdated({
      ...player,
      checked_in_at: data.player?.checked_in_at ?? new Date().toISOString(),
      phone: phone.trim() || player.phone,
    });
    setConfirmation({
      pool: player.pool_letter,
      partner: player.partner_label,
      notify: data.notify
        ? { delivered: data.notify.delivered ?? 0, sandbox: !!data.notify.sandbox }
        : null,
    });
    setBusy(null);
  }

  async function undo() {
    setError(null);
    setBusy("out");
    const res = await fetch(
      `/api/admin/tournaments/${tournamentId}/check-in/${player.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Undo failed");
      setBusy(null);
      return;
    }
    onUpdated({ ...player, checked_in_at: null });
    setConfirmation(null);
    setBusy(null);
    onClose();
  }

  const checkedIn = !!player.checked_in_at || !!confirmation;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => busy === null && onClose()}
      />
      <div className="relative w-full max-w-md rounded-t-2xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <p className="text-xs text-zinc-500">{player.category_label}</p>
            <h2 className="mt-0.5 text-lg font-semibold text-white">
              {player.first_name} {player.last_name}
            </h2>
            <p className="text-xs text-zinc-400">{player.email}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            aria-label="Close"
            className="text-xs text-zinc-400 hover:text-white disabled:opacity-50"
          >
            Close ✕
          </button>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-xs">
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Pool</dt>
            <dd className="mt-0.5 text-white">{player.pool_letter ?? "Unassigned"}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Partner</dt>
            <dd className="mt-0.5 truncate text-white">{player.partner_label}</dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Payment</dt>
            <dd className="mt-0.5">
              {player.team_paid ? (
                <span className="text-emerald-400">Paid</span>
              ) : (
                <span className="text-amber-400">Unpaid</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Status</dt>
            <dd className="mt-0.5">
              {checkedIn ? (
                <span className="text-emerald-400">✓ Checked in</span>
              ) : (
                <span className="text-zinc-400">Not checked in</span>
              )}
            </dd>
          </div>
        </dl>

        {!checkedIn && (
          <div className="mb-4">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Phone {player.phone ? "(on file)" : "(missing — add it)"}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              placeholder="(787) 555-1234"
              disabled={busy !== null}
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
            />
            <p className="mt-1 text-[11px] text-zinc-500">
              Without a phone, the WhatsApp confirmation can&rsquo;t send.
            </p>
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {confirmation && (
          <div className="mb-3 rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-xs">
            <p className="font-semibold text-emerald-300">✓ Checked in</p>
            <p className="mt-0.5 text-zinc-200">
              Pool {confirmation.pool ?? "—"} · {confirmation.partner}
            </p>
            {confirmation.notify && (
              <p className="mt-0.5 text-[11px] text-zinc-400">
                {confirmation.notify.delivered > 0
                  ? `WhatsApp sent${confirmation.notify.sandbox ? " (sandbox → owner)" : ""}.`
                  : "No WhatsApp sent (no phone on file)."}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          {!checkedIn ? (
            <button
              type="button"
              onClick={checkIn}
              disabled={busy !== null}
              className="rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
            >
              {busy === "in" ? "Checking in…" : "Check in"}
            </button>
          ) : (
            <button
              type="button"
              onClick={undo}
              disabled={busy !== null}
              className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50"
            >
              {busy === "out" ? "Undoing…" : "Undo check-in"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
