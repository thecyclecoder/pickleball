"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type GraphicRow = {
  id: string;
  type: string;
  svg: string;
  png_url: string | null;
  approved: boolean;
  feedback_history: { ts: string; prompt: string }[];
  updated_at: string;
};

export function GraphicsPanel({
  tournamentId,
  graphics: initialGraphics,
  hasReferenceImage,
}: {
  tournamentId: string;
  graphics: GraphicRow[];
  hasReferenceImage: boolean;
}) {
  return (
    <details className="group rounded-xl border border-zinc-800 bg-zinc-900">
      <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold text-white">Graphics (AI)</h3>
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

      <div className="space-y-5 border-t border-zinc-800 px-5 py-4">
        {!hasReferenceImage && (
          <p className="rounded-md border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
            Upload a tournament cover image first. The AI uses your first slideshow image as the
            reference for color and mood.
          </p>
        )}

        <GraphicTile
          tournamentId={tournamentId}
          type="base"
          label="Base template"
          description="The visual shell that establishes design language for this tournament — used as the starting point for all per-event graphics (pool results, bracket, finals)."
          existing={initialGraphics.find((g) => g.type === "base") ?? null}
          disabled={!hasReferenceImage}
        />

        {/* V2 will fan out to pool_result, bracket_qf/sf/f, tournament_result.
            Wire those tiles here once the base template is approved. */}
      </div>
    </details>
  );
}

function GraphicTile({
  tournamentId,
  type,
  label,
  description,
  existing,
  disabled,
}: {
  tournamentId: string;
  type: string;
  label: string;
  description: string;
  existing: GraphicRow | null;
  disabled: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<"generate" | "approve" | "delete" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [showFeedback, setShowFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate(withFeedback = false) {
    setError(null);
    setBusy("generate");
    const body: Record<string, string> = {};
    if (withFeedback && feedback.trim()) body.feedback = feedback.trim();
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/graphics/${type}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || "Generation failed");
      setBusy(null);
      return;
    }
    setFeedback("");
    setShowFeedback(false);
    router.refresh();
    setBusy(null);
  }

  async function toggleApprove() {
    if (!existing) return;
    setError(null);
    setBusy("approve");
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/graphics/${type}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved: !existing.approved }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Approve failed");
      setBusy(null);
      return;
    }
    router.refresh();
    setBusy(null);
  }

  async function remove() {
    if (!existing) return;
    if (!confirm(`Drop the current ${label.toLowerCase()}? Next generate starts fresh.`)) return;
    setBusy("delete");
    const res = await fetch(`/api/admin/tournaments/${tournamentId}/graphics/${type}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Delete failed");
      setBusy(null);
      return;
    }
    router.refresh();
    setBusy(null);
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-0.5 text-xs text-zinc-400">{description}</p>
        </div>
        {existing && (
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
              existing.approved
                ? "bg-emerald-950/60 text-emerald-300"
                : "bg-amber-950/60 text-amber-300"
            }`}
          >
            {existing.approved ? "Approved" : "Draft"}
          </span>
        )}
      </div>

      {existing?.png_url && (
        <a
          href={existing.png_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block overflow-hidden rounded-lg border border-zinc-800 bg-black"
          title="Open full-size"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={existing.png_url}
            alt={`${label} preview`}
            className="block h-auto w-full max-w-md"
          />
        </a>
      )}

      {error && (
        <p className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {showFeedback && (
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.currentTarget.value)}
          placeholder="What should change? e.g. 'Make the title bigger', 'Less green, more contrast', 'Move the brand strip to the bottom'"
          rows={3}
          disabled={busy !== null}
          className="block w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white placeholder:text-zinc-500 focus:border-emerald-600 focus:outline-none"
        />
      )}

      <div className="flex flex-wrap gap-2">
        {!existing ? (
          <button
            type="button"
            onClick={() => generate(false)}
            disabled={disabled || busy !== null}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy === "generate" ? "Generating…" : "Generate"}
          </button>
        ) : (
          <>
            {!showFeedback ? (
              <>
                <button
                  type="button"
                  onClick={() => setShowFeedback(true)}
                  disabled={busy !== null}
                  className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-600 disabled:opacity-50"
                >
                  Regenerate with feedback
                </button>
                <button
                  type="button"
                  onClick={() => generate(false)}
                  disabled={busy !== null}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-700 disabled:opacity-50"
                >
                  {busy === "generate" ? "Regenerating…" : "Regenerate (no feedback)"}
                </button>
                <button
                  type="button"
                  onClick={toggleApprove}
                  disabled={busy !== null}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
                    existing.approved
                      ? "border border-zinc-700 bg-zinc-900 text-zinc-200 hover:border-zinc-600"
                      : "bg-emerald-600 text-white hover:bg-emerald-500"
                  }`}
                >
                  {busy === "approve"
                    ? "…"
                    : existing.approved
                      ? "Unapprove"
                      : "Approve"}
                </button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={busy !== null}
                  className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50"
                >
                  {busy === "delete" ? "Removing…" : "Delete"}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => generate(true)}
                  disabled={busy !== null || !feedback.trim()}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {busy === "generate" ? "Regenerating…" : "Submit & regenerate"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowFeedback(false);
                    setFeedback("");
                  }}
                  disabled={busy !== null}
                  className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-400 hover:border-zinc-700 disabled:opacity-50"
                >
                  Cancel
                </button>
              </>
            )}
          </>
        )}
      </div>

      {existing?.feedback_history && existing.feedback_history.length > 0 && (
        <details className="group/history border-t border-zinc-800 pt-3">
          <summary className="cursor-pointer text-[10px] uppercase tracking-wider text-zinc-500 hover:text-zinc-300">
            Feedback history ({existing.feedback_history.length})
          </summary>
          <ul className="mt-2 space-y-1 text-xs text-zinc-400">
            {existing.feedback_history.map((f, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-zinc-600">{i + 1}.</span>
                <span>{f.prompt}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
