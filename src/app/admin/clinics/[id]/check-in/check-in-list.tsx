"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type ClinicCheckInRow = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  paid: boolean;
  checked_in_at: string | null;
};

export function ClinicCheckInList({
  clinicId,
  initialRows,
  paymentQrUrl,
  paymentInstructions,
}: {
  clinicId: string;
  initialRows: ClinicCheckInRow[];
  paymentQrUrl: string | null;
  paymentInstructions: string | null;
}) {
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [rows, setRows] = useState<ClinicCheckInRow[]>(initialRows);
  const router = useRouter();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      `${r.first_name} ${r.last_name} ${r.email}`.toLowerCase().includes(q)
    );
  }, [search, rows]);

  const checkedCount = rows.filter((r) => r.checked_in_at).length;
  const open = openId ? rows.find((r) => r.id === openId) ?? null : null;

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 mb-3 bg-zinc-950 px-4 pb-3 sm:-mx-6 sm:px-6">
        <p className="mb-2 text-xs text-zinc-400">
          <span className="text-emerald-400">{checkedCount}</span> / {rows.length} checked in
        </p>
        <input
          type="search"
          placeholder="Search registrants…"
          value={search}
          onChange={(e) => setSearch(e.currentTarget.value)}
          className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
        />
      </div>

      <ul className="space-y-2">
        {filtered.length === 0 && (
          <li className="rounded-lg border border-dashed border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
            {search ? "No matches." : "No registrants."}
          </li>
        )}
        {filtered.map((r) => {
          const checkedIn = !!r.checked_in_at;
          return (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOpenId(r.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left ${
                  checkedIn
                    ? "border-emerald-900/60 bg-emerald-950/20"
                    : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">
                    {r.first_name} {r.last_name}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-zinc-500">{r.email}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {checkedIn ? (
                    <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white">
                      ✓ In
                    </span>
                  ) : (
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-[10px] font-medium text-zinc-400">
                      Tap
                    </span>
                  )}
                  <div className="flex gap-1">
                    {!r.paid && (
                      <span className="rounded bg-amber-950/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase text-amber-300">
                        Unpaid
                      </span>
                    )}
                    {!r.phone && (
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
        <ClinicDrawer
          clinicId={clinicId}
          row={open}
          paymentQrUrl={paymentQrUrl}
          paymentInstructions={paymentInstructions}
          onClose={() => setOpenId(null)}
          onUpdated={(updated) => {
            setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ClinicDrawer({
  clinicId,
  row,
  paymentQrUrl,
  paymentInstructions,
  onClose,
  onUpdated,
}: {
  clinicId: string;
  row: ClinicCheckInRow;
  paymentQrUrl: string | null;
  paymentInstructions: string | null;
  onClose: () => void;
  onUpdated: (r: ClinicCheckInRow) => void;
}) {
  const [phone, setPhone] = useState(row.phone ?? "");
  const [paid, setPaid] = useState(row.paid);
  const [busy, setBusy] = useState<"in" | "out" | "pay" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function markPaid() {
    setError(null);
    setBusy("pay");
    const res = await fetch(`/api/admin/clinic-registrations/${row.id}/paid`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paid: true }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Mark paid failed");
      setBusy(null);
      return;
    }
    setPaid(true);
    onUpdated({ ...row, paid: true });
    setBusy(null);
  }

  async function checkIn() {
    setError(null);
    setBusy("in");
    const body: Record<string, string> = {};
    if (phone.trim() && phone.trim() !== row.phone) body.phone = phone.trim();
    const res = await fetch(
      `/api/admin/clinics/${clinicId}/check-in/${row.id}`,
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
      ...row,
      checked_in_at: data.registration?.checked_in_at ?? new Date().toISOString(),
      phone: phone.trim() || row.phone,
    });
    setDone(true);
    setBusy(null);
  }

  async function undo() {
    setError(null);
    setBusy("out");
    const res = await fetch(
      `/api/admin/clinics/${clinicId}/check-in/${row.id}`,
      { method: "DELETE" }
    );
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Undo failed");
      setBusy(null);
      return;
    }
    onUpdated({ ...row, checked_in_at: null });
    setDone(false);
    setBusy(null);
    onClose();
  }

  const checkedIn = !!row.checked_in_at || done;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => busy === null && onClose()}
      />
      <div className="relative w-full max-w-md rounded-t-2xl border border-zinc-800 bg-zinc-950 p-5 sm:rounded-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white">
              {row.first_name} {row.last_name}
            </h2>
            <p className="text-xs text-zinc-400">{row.email}</p>
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
            <dt className="text-[10px] uppercase tracking-wider text-zinc-500">Payment</dt>
            <dd className="mt-0.5">
              {paid ? (
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

        {!paid && paymentQrUrl && (
          <div className="mb-4 rounded-lg border border-amber-900/60 bg-amber-950/20 p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-300">
              Unpaid — show this to the player
            </p>
            {paymentInstructions && (
              <p className="mt-1 whitespace-pre-wrap text-xs text-amber-100/80">
                {paymentInstructions}
              </p>
            )}
            <div className="mt-2 overflow-hidden rounded-md border border-zinc-800 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={paymentQrUrl} alt="Payment QR" className="block h-auto w-full" />
            </div>
            <button
              type="button"
              onClick={markPaid}
              disabled={busy !== null}
              className="mt-3 w-full rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-2 text-xs font-medium text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
            >
              {busy === "pay" ? "Marking paid…" : "Mark as paid"}
            </button>
          </div>
        )}
        {!paid && !paymentQrUrl && (
          <div className="mb-4 rounded-lg border border-amber-900/60 bg-amber-950/20 px-3 py-2 text-xs text-amber-200">
            Registration is unpaid. Set a payment QR on the clinic (or workspace) to
            show it here, or just collect manually.
            <button
              type="button"
              onClick={markPaid}
              disabled={busy !== null}
              className="mt-2 block w-full rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-2 font-medium text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
            >
              {busy === "pay" ? "Marking paid…" : "Mark as paid"}
            </button>
          </div>
        )}
        {!checkedIn && (
          <div className="mb-4">
            <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              Phone {row.phone ? "(on file)" : "(missing — add it)"}
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.currentTarget.value)}
              placeholder="(787) 555-1234"
              disabled={busy !== null}
              className="mt-1 block w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
            />
          </div>
        )}

        {error && (
          <p className="mb-3 rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}

        {done && (
          <div className="mb-3 rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-xs">
            <p className="font-semibold text-emerald-300">✓ Checked in</p>
          </div>
        )}

        {!checkedIn ? (
          <button
            type="button"
            onClick={checkIn}
            disabled={busy !== null}
            className="block w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy === "in" ? "Checking in…" : "Check in"}
          </button>
        ) : (
          <button
            type="button"
            onClick={undo}
            disabled={busy !== null}
            className="block w-full rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-3 text-sm text-red-300 hover:bg-red-950/50 disabled:opacity-50"
          >
            {busy === "out" ? "Undoing…" : "Undo check-in"}
          </button>
        )}
      </div>
    </div>
  );
}
