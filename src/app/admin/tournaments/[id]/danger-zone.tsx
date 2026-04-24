"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DangerZone({
  tournamentId,
  tournamentTitle,
}: {
  tournamentId: string;
  tournamentTitle: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const entered = prompt(
      `Type "${tournamentTitle}" to confirm deletion. All categories, teams and players will be removed.`
    );
    if (entered !== tournamentTitle) return;
    setBusy(true);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/tournaments");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Failed to delete");
      setBusy(false);
    }
  }

  return (
    <section className="rounded-xl border border-red-900 bg-red-950/20 p-5">
      <h3 className="text-sm font-semibold text-red-300">Danger zone</h3>
      <p className="mt-1 text-xs text-red-200/70">
        Permanently delete this tournament. Everything — categories, teams, players — will be removed.
      </p>
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="mt-3 rounded-lg border border-red-800 bg-red-900/40 px-4 py-2 text-sm text-red-200 hover:bg-red-900/60 disabled:opacity-50"
      >
        {busy ? "Deleting…" : "Delete tournament"}
      </button>
    </section>
  );
}
