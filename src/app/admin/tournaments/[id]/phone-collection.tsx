"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function PhoneCollectionTile({
  tournamentId,
  totalPlayers,
  withPhone,
  missingPhone,
}: {
  tournamentId: string;
  totalPlayers: number;
  withPhone: number;
  missingPhone: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [lastResult, setLastResult] = useState<string | null>(null);
  const pct = totalPlayers === 0 ? 0 : Math.round((withPhone / totalPlayers) * 100);

  function sendReminders() {
    if (missingPhone === 0) return;
    const ok = window.confirm(
      `Email ${missingPhone} ${missingPhone === 1 ? "player" : "players"} who haven't added a phone yet?\n\n` +
        `Each gets a sign-in link to a self-update form.`
    );
    if (!ok) return;
    setLastResult(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/send-phone-updates`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        setLastResult(body.error || "Failed");
        return;
      }
      setLastResult(`Sent ${body.sent}${body.failed ? `, ${body.failed} failed` : ""}`);
      router.refresh();
    });
  }

  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">Phone collection</h3>
          <p className="mt-0.5 text-xs text-zinc-500">
            For WhatsApp tournament updates — pool assignments, court calls, live scores.
          </p>
        </div>
        {missingPhone > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={sendReminders}
            className="rounded-md border border-emerald-700 bg-emerald-950/40 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/60 disabled:opacity-60"
          >
            {pending
              ? "Sending…"
              : `Email ${missingPhone} missing player${missingPhone === 1 ? "" : "s"}`}
          </button>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Active players" value={totalPlayers} tone="zinc" />
        <Stat label="With phone" value={withPhone} tone="emerald" />
        <Stat label="Missing phone" value={missingPhone} tone={missingPhone > 0 ? "amber" : "zinc"} />
      </div>

      <div className="mt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <div
            className="h-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-zinc-500">{pct}% collected</p>
      </div>

      {lastResult && (
        <p className="mt-3 text-xs text-emerald-300">{lastResult}</p>
      )}
    </section>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "zinc" | "emerald" | "amber";
}) {
  const labelCls =
    tone === "emerald"
      ? "text-emerald-400"
      : tone === "amber"
        ? "text-amber-400"
        : "text-zinc-500";
  const valueCls =
    tone === "emerald"
      ? "text-emerald-300"
      : tone === "amber"
        ? "text-amber-300"
        : "text-white";
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3">
      <p className={`text-[10px] font-medium uppercase tracking-wider ${labelCls}`}>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-semibold ${valueCls}`}>{value}</p>
    </div>
  );
}
