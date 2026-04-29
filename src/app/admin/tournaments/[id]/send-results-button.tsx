"use client";

import { useState } from "react";

export function CommunicationsPanel({
  tournamentId,
  tournamentTitle,
  sandboxMode,
}: {
  tournamentId: string;
  tournamentTitle: string;
  sandboxMode: boolean;
}) {
  const [busy, setBusy] = useState<"start" | "results" | null>(null);
  const [startMsg, setStartMsg] = useState<string | null>(null);
  const [resultsMsg, setResultsMsg] = useState<string | null>(null);

  async function startTournament() {
    const prompt = sandboxMode
      ? `Sandbox is ON — the start-tournament message will go ONLY to the workspace owner (one representative pool sample). Send now?`
      : `Send the "tournament starting" message to every active player of "${tournamentTitle}"? Players with phones get WhatsApp; phone-less players get email.`;
    if (!confirm(prompt)) return;
    setBusy("start");
    setStartMsg(null);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/start`, {
      method: "POST",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStartMsg(body.error || "Failed to send");
      setBusy(null);
      return;
    }
    setStartMsg(
      `Sent ${body.whatsappDelivered + body.emailDelivered}/${body.attempted}${
        body.sandbox ? " (sandbox)" : ""
      }: ${body.whatsappDelivered} WhatsApp, ${body.emailDelivered} email.${
        body.failures?.length ? ` ${body.failures.length} failed.` : ""
      }`
    );
    setBusy(null);
  }

  async function sendResults() {
    const prompt = sandboxMode
      ? `Sandbox is ON — the results email will go ONLY to the workspace owner. Send now?`
      : `Send the results email to every registered player of "${tournamentTitle}"?`;
    if (!confirm(prompt)) return;
    setBusy("results");
    setResultsMsg(null);
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/send-results`, {
      method: "POST",
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setResultsMsg(body.error || "Failed to send");
      setBusy(null);
      return;
    }
    setResultsMsg(
      `Sent ${body.delivered}/${body.attempted}${body.sandbox ? " (sandbox)" : ""}.${
        body.failures?.length ? ` ${body.failures.length} failed.` : ""
      }`
    );
    setBusy(null);
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
      <div className="space-y-5 border-t border-zinc-800 px-5 py-4 text-xs text-zinc-400">
        <div>
          <p className="font-medium text-zinc-200">Start tournament</p>
          <p className="mt-1">
            Pings every active player with their pool schedule. Round-1 teams get an extra
            &ldquo;you&rsquo;re up first&rdquo; line. WhatsApp if the player has a phone on file,
            email otherwise.
          </p>
          <button
            type="button"
            onClick={startTournament}
            disabled={busy !== null}
            className="mt-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy === "start" ? "Sending…" : "Start tournament"}
          </button>
          {startMsg && <p className="mt-2 text-zinc-300">{startMsg}</p>}
        </div>

        <div className="border-t border-zinc-800 pt-4">
          <p className="font-medium text-zinc-200">Send results email</p>
          <p className="mt-1">
            Recap email — winner, runner-up, and semifinalists per category. Categories without
            a scored final are skipped.
          </p>
          <button
            type="button"
            onClick={sendResults}
            disabled={busy !== null}
            className="mt-2 rounded-lg border border-emerald-700 bg-emerald-950/40 px-4 py-2 text-sm text-emerald-200 hover:bg-emerald-950/60 disabled:opacity-50"
          >
            {busy === "results" ? "Sending…" : "Send results email"}
          </button>
          {resultsMsg && <p className="mt-2 text-zinc-300">{resultsMsg}</p>}
        </div>
      </div>
    </details>
  );
}

export const SendResultsButton = CommunicationsPanel;
