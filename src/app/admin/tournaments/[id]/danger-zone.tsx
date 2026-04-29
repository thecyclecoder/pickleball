"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DangerZone({
  tournamentId,
  tournamentTitle,
  isOwner,
}: {
  tournamentId: string;
  tournamentTitle: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"delete" | "reset" | null>(null);
  const [resetMsg, setResetMsg] = useState<string | null>(null);

  async function remove() {
    const entered = prompt(
      `Type "${tournamentTitle}" to confirm deletion. All categories, teams and players will be removed.`
    );
    if (entered !== tournamentTitle) return;
    setBusy("delete");
    const res = await fetch(`/api/admin/tournaments/${tournamentId}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/tournaments");
      router.refresh();
    } else {
      const body = await res.json().catch(() => ({}));
      alert(body.error || "Failed to delete");
      setBusy(null);
    }
  }

  async function resetScoring() {
    const entered = prompt(
      `Reset all scoring? Every recorded match score in "${tournamentTitle}" will be cleared. ` +
        `Pool memberships and the schedule stay intact.\n\nType "RESET" to confirm.`
    );
    if (entered !== "RESET") return;
    setBusy("reset");
    setResetMsg(null);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/reset-scoring`, {
      method: "POST",
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) {
      setResetMsg(`Cleared ${body.cleared ?? 0} game${body.cleared === 1 ? "" : "s"}.`);
      router.refresh();
    } else {
      alert(body.error || "Failed to reset scoring");
    }
    setBusy(null);
  }

  return (
    <details className="group rounded-xl border border-red-900 bg-red-950/20">
      <summary className="flex cursor-pointer list-none items-center justify-between p-5 [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold text-red-300">Danger zone</h3>
        <svg
          className="h-4 w-4 text-red-300/60 transition-transform group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="px-5 pb-5">

      {isOwner && (
        <div className="mt-3 border-b border-red-900/60 pb-4">
          <p className="text-xs text-red-200/70">
            Reset all scoring for this tournament. Every recorded match score is cleared so you can
            run the tournament again from scratch. Pool memberships, seeds, and the schedule are
            kept intact.
          </p>
          <button
            type="button"
            onClick={resetScoring}
            disabled={busy !== null}
            className="mt-3 rounded-lg border border-red-800 bg-red-900/40 px-4 py-2 text-sm text-red-200 hover:bg-red-900/60 disabled:opacity-50"
          >
            {busy === "reset" ? "Resetting…" : "Reset all scoring"}
          </button>
          {resetMsg && <p className="mt-2 text-xs text-red-200/80">{resetMsg}</p>}
          <p className="mt-2 text-[11px] text-red-300/60">Owner role only.</p>
        </div>
      )}

      <p className="mt-3 text-xs text-red-200/70">
        Permanently delete this tournament. Everything — categories, teams, players — will be removed.
      </p>
      <button
        type="button"
        onClick={remove}
        disabled={busy !== null}
        className="mt-3 rounded-lg border border-red-800 bg-red-900/40 px-4 py-2 text-sm text-red-200 hover:bg-red-900/60 disabled:opacity-50"
      >
        {busy === "delete" ? "Deleting…" : "Delete tournament"}
      </button>
      </div>
    </details>
  );
}
