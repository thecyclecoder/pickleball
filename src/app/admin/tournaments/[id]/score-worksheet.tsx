"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { stageRulesText, type TournamentFormat } from "@/lib/types";
import { rulesForStage } from "@/lib/score-validate";

export type WorksheetGame = {
  id: string;
  stage: "pool" | "qf" | "sf" | "f";
  team_a_label: string;
  team_b_label: string;
  score_a: number | null;
  score_b: number | null;
  format: TournamentFormat | null;
  pool_letter: string | null;
};

const STAGE_LABELS: Record<WorksheetGame["stage"], string> = {
  pool: "Pool play",
  qf: "Quarterfinals",
  sf: "Semifinals",
  f: "Finals",
};

export function ScoreWorksheet({
  game,
  onClose,
}: {
  game: WorksheetGame | null;
  onClose: () => void;
}) {
  // Re-mount the inner form per game so its useState defaults pick up the
  // new game's existing scores cleanly — no effect-driven resets.
  if (!game) return null;
  return <WorksheetForm key={game.id} game={game} onClose={onClose} />;
}

function WorksheetForm({
  game,
  onClose,
}: {
  game: WorksheetGame;
  onClose: () => void;
}) {
  const router = useRouter();
  const [scoreA, setScoreA] = useState(game.score_a == null ? "" : String(game.score_a));
  const [scoreB, setScoreB] = useState(game.score_b == null ? "" : String(game.score_b));
  const [forfeit, setForfeit] = useState(false);
  const [busy, setBusy] = useState<"submit" | "clear" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rules = game.format ? rulesForStage(game.format, game.stage) : null;
  const rulesLabel = rules ? stageRulesText(rules.gamesTo, rules.winBy, rules.bestOf) : "—";
  const stageLabel = STAGE_LABELS[game.stage];
  const hasScore = game.score_a != null || game.score_b != null;

  function applyForfeit(winner: "a" | "b") {
    if (!rules) return;
    setForfeit(true);
    if (winner === "a") {
      setScoreA(String(rules.gamesTo));
      setScoreB("0");
    } else {
      setScoreA("0");
      setScoreB(String(rules.gamesTo));
    }
  }

  async function submit() {
    setError(null);
    const a = Number(scoreA);
    const b = Number(scoreB);
    if (!Number.isFinite(a) || !Number.isFinite(b)) {
      setError("Enter both scores");
      return;
    }
    setBusy("submit");
    const res = await fetch(`/api/admin/games/${game.id}/score`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ score_a: a, score_b: b, forfeit }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Failed to save score");
      setBusy(null);
      return;
    }
    router.refresh();
    onClose();
  }

  async function clear() {
    if (!confirm("Clear this score? The game goes back to unplayed.")) return;
    setError(null);
    setBusy("clear");
    const res = await fetch(`/api/admin/games/${game.id}/score`, { method: "DELETE" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Failed to clear score");
      setBusy(null);
      return;
    }
    router.refresh();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm"
        onClick={() => busy === null && onClose()}
      />
      <aside className="flex w-full max-w-md flex-col overflow-y-auto border-l border-zinc-800 bg-zinc-950">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-800 px-5 py-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400">
              {stageLabel}
              {game.pool_letter ? ` · Pool ${game.pool_letter}` : ""}
            </p>
            <p className="mt-1 text-sm font-semibold text-white">Enter score</p>
            <p className="mt-0.5 text-xs text-zinc-500">{rulesLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy !== null}
            className="text-xs text-zinc-400 hover:text-white disabled:opacity-50"
            aria-label="Close worksheet"
          >
            Close ✕
          </button>
        </header>

        {!rules && (
          <div className="border-b border-amber-900/60 bg-amber-950/30 px-5 py-3 text-xs text-amber-200">
            This category has no format set for {stageLabel.toLowerCase()}. Pick a format on the
            category before entering scores.
          </div>
        )}

        <div className="flex-1 space-y-5 px-5 py-5">
          <ScoreRow
            label={game.team_a_label}
            value={scoreA}
            onChange={(v) => {
              setScoreA(v);
              setForfeit(false);
            }}
            disabled={!rules || busy !== null}
          />
          <p className="text-center text-[11px] uppercase tracking-wider text-zinc-600">vs</p>
          <ScoreRow
            label={game.team_b_label}
            value={scoreB}
            onChange={(v) => {
              setScoreB(v);
              setForfeit(false);
            }}
            disabled={!rules || busy !== null}
          />

          {rules && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-3 text-xs">
              <p className="font-semibold text-zinc-300">Forfeit / withdrawal</p>
              <p className="mt-0.5 text-zinc-500">
                Records the result as {rules.gamesTo}-0.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => applyForfeit("a")}
                  disabled={busy !== null}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 hover:border-zinc-700 disabled:opacity-50"
                >
                  {game.team_a_label} wins
                </button>
                <button
                  type="button"
                  onClick={() => applyForfeit("b")}
                  disabled={busy !== null}
                  className="flex-1 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1.5 text-[11px] text-zinc-200 hover:border-zinc-700 disabled:opacity-50"
                >
                  {game.team_b_label} wins
                </button>
              </div>
              {forfeit && (
                <p className="mt-2 text-[11px] text-amber-300">
                  Forfeit applied — saving will record this as a forfeit.
                </p>
              )}
            </div>
          )}

          {error && (
            <p className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}
        </div>

        <footer className="flex flex-col gap-2 border-t border-zinc-800 px-5 py-4">
          <button
            type="button"
            onClick={submit}
            disabled={!rules || busy !== null}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy === "submit" ? "Saving…" : hasScore ? "Update score" : "Save score"}
          </button>
          {hasScore && (
            <button
              type="button"
              onClick={clear}
              disabled={busy !== null}
              className="rounded-lg border border-red-900/60 bg-red-950/30 px-4 py-2 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-50"
            >
              {busy === "clear" ? "Clearing…" : "Clear score"}
            </button>
          )}
        </footer>
      </aside>
    </div>
  );
}

function ScoreRow({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="min-w-0 flex-1 truncate text-sm text-white">{label}</p>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        disabled={disabled}
        className="w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-right text-lg font-bold text-white focus:border-emerald-600 focus:outline-none disabled:opacity-50"
        placeholder="—"
      />
    </div>
  );
}
