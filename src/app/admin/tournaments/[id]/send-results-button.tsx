"use client";

import { useState } from "react";

export function SendResultsButton({
  tournamentId,
  tournamentTitle,
  sandboxMode,
}: {
  tournamentId: string;
  tournamentTitle: string;
  sandboxMode: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function send() {
    const prompt1 = sandboxMode
      ? `Sandbox mode is ON — the results email will go ONLY to the workspace owner. Send it now?`
      : `Send the results email to every registered player of "${tournamentTitle}"? This blasts every unique email on the roster.`;
    if (!confirm(prompt1)) return;
    setBusy(true);
    setMsg(null);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/send-results`, {
      method: "POST",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMsg(body.error || "Failed to send");
      setBusy(false);
      return;
    }
    setMsg(
      `Sent ${body.delivered}/${body.attempted}${body.sandbox ? " (sandbox)" : ""}.${
        body.failures?.length ? ` ${body.failures.length} failed.` : ""
      }`
    );
    setBusy(false);
  }

  return (
    <details className="group rounded-xl border border-zinc-800 bg-zinc-900">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold text-white">Communications</h3>
        <svg
          className="h-4 w-4 text-zinc-500 transition-transform group-open:rotate-180"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </summary>
      <div className="border-t border-zinc-800 px-5 py-4 text-xs text-zinc-400">
        <p>
          Email every registered player a recap of the tournament — winner, runner-up, and
          semifinalists per category, with a link back to the public bracket. Categories without
          a scored final are skipped.
        </p>
        <button
          type="button"
          onClick={send}
          disabled={busy}
          className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          {busy ? "Sending…" : "Send tournament results email"}
        </button>
        {msg && <p className="mt-2 text-zinc-300">{msg}</p>}
      </div>
    </details>
  );
}
