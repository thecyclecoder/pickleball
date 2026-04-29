"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { categoryLabel } from "@/lib/categories";
import type {
  CategoryType,
  Game,
  Player,
  Team,
  TournamentCategory,
  TournamentCourt,
  TournamentFormat,
  TournamentPool,
} from "@/lib/types";
import { ScoreWorksheet, type WorksheetGame } from "./score-worksheet";
import { calculatePoolStandings, tiebreakerLabel } from "@/lib/standings";

type CategoryView = TournamentCategory & {
  pools: TournamentPool[];
  teams: (Team & { players: Player[] })[];
  games: Game[];
};

export function PoolsPanel({
  tournamentId,
  categories,
  courts,
  formats,
}: {
  tournamentId: string;
  categories: CategoryView[];
  courts: TournamentCourt[];
  formats: TournamentFormat[];
}) {
  const courtById = new Map(courts.map((c) => [c.id, c]));
  const formatById = useMemo(
    () => new Map(formats.map((f) => [f.id, f])),
    [formats]
  );

  const [openGame, setOpenGame] = useState<WorksheetGame | null>(null);

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Pools &amp; bracket</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Snake-seeded by combined player rating, round-robin within each pool. Cancelled and
          waitlisted teams are excluded. Regenerate anytime — wipes prior pool/game data and
          reseeds from current registrations.
        </p>
      </div>
      {categories.map((c) => (
        <CategoryPools
          key={c.id}
          tournamentId={tournamentId}
          category={c}
          courtById={courtById}
          format={c.format_id ? formatById.get(c.format_id) ?? null : null}
          onOpenGame={setOpenGame}
        />
      ))}
      <ScoreWorksheet game={openGame} onClose={() => setOpenGame(null)} />
    </section>
  );
}

function CategoryPools({
  tournamentId,
  category,
  courtById,
  format,
  onOpenGame,
}: {
  tournamentId: string;
  category: CategoryView;
  courtById: Map<string, TournamentCourt>;
  format: TournamentFormat | null;
  onOpenGame: (g: WorksheetGame) => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const activeTeams = category.teams.filter(
    (t) => t.status === "registered" || t.status === "confirmed"
  );
  const hasPools = category.pools.length > 0;

  function generate(regenerating: boolean) {
    if (regenerating) {
      const ok = window.confirm(
        "Regenerate pools? This wipes existing pool/game data (including any scores) and re-seeds from current registrations."
      );
      if (!ok) return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/categories/${category.id}/pools/generate`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to generate");
        return;
      }
      router.refresh();
    });
  }

  function reset() {
    const ok = window.confirm("Clear pools and games for this category?");
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/categories/${category.id}/pools/generate`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to reset");
        return;
      }
      router.refresh();
    });
  }

  function seedBracket(reseed: boolean) {
    if (reseed) {
      const ok = window.confirm(
        "Re-seed the bracket? Existing QF/SF/F games and any recorded bracket scores will be wiped."
      );
      if (!ok) return;
    }
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/categories/${category.id}/bracket/seed`,
        { method: "POST" }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error || "Failed to seed bracket");
        return;
      }
      router.refresh();
    });
  }

  function clearBracket() {
    const ok = window.confirm(
      "Clear the bracket? All QF/SF/F games and recorded bracket scores will be removed. Pool play stays intact."
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await fetch(
        `/api/admin/tournaments/${tournamentId}/categories/${category.id}/bracket/seed`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const body = await res.json();
        setError(body.error || "Failed to clear bracket");
        return;
      }
      router.refresh();
    });
  }

  // Group games by pool then round
  const gamesByPool = new Map<string, Game[]>();
  for (const g of category.games) {
    if (!g.pool_id) continue;
    const arr = gamesByPool.get(g.pool_id) ?? [];
    arr.push(g);
    gamesByPool.set(g.pool_id, arr);
  }

  // Teams by pool + by-id helpers
  const teamsByPool = new Map<string, (Team & { players: Player[] })[]>();
  for (const t of category.teams) {
    if (!t.pool_id) continue;
    const arr = teamsByPool.get(t.pool_id) ?? [];
    arr.push(t);
    teamsByPool.set(t.pool_id, arr);
  }
  const teamById = new Map(category.teams.map((t) => [t.id, t]));

  function teamLabel(t: (Team & { players: Player[] }) | undefined): string {
    if (!t) return "—";
    const sorted = [...t.players].sort(
      (a, b) => Number(b.is_captain) - Number(a.is_captain)
    );
    return (
      sorted
        .map((p) => `${p.first_name} ${p.last_name.slice(0, 1)}.`)
        .join(" / ") || "Team"
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 px-5 py-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{categoryLabel(category)}</h3>
          <p className="text-xs text-zinc-500">
            {activeTeams.length} active team{activeTeams.length === 1 ? "" : "s"}
            {hasPools && (
              <>
                {" · "}
                {category.pools.length} pool{category.pools.length === 1 ? "" : "s"} ·{" "}
                {category.games.length} game{category.games.length === 1 ? "" : "s"}
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {hasPools ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => generate(true)}
                className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-700 disabled:opacity-60"
              >
                Regenerate
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={reset}
                className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-60"
              >
                Reset
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={pending || activeTeams.length < 2}
              onClick={() => generate(false)}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
            >
              {pending ? "Generating…" : "Generate pools"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <p className="border-b border-red-900/60 bg-red-950/30 px-5 py-2 text-xs text-red-300">
          {error}
        </p>
      )}

      {!hasPools ? (
        <div className="px-5 py-6 text-center text-sm text-zinc-500">
          {activeTeams.length < 2
            ? "Need at least 2 active teams before pools can be generated."
            : "No pools yet. Click Generate when registration is final."}
        </div>
      ) : (
        <div className="grid gap-4 p-5 lg:grid-cols-2">
          {category.pools
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((pool) => {
              const teams = (teamsByPool.get(pool.id) ?? []).sort(
                (a, b) => (a.pool_seed ?? 0) - (b.pool_seed ?? 0)
              );
              const games = (gamesByPool.get(pool.id) ?? []).sort(
                (a, b) => a.round - b.round || a.sort_order - b.sort_order
              );
              const courtIds = Array.from(
                new Set(games.map((g) => g.court_id).filter((v): v is string => !!v))
              );
              const courtLabel = courtIds.length === 0
                ? null
                : courtIds.length === 1
                  ? courtBadge(courtById.get(courtIds[0]))
                  : `${courtIds.length} courts`;

              return (
                <div
                  key={pool.id}
                  className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950"
                >
                  <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-900/60 px-4 py-2">
                    <p className="text-sm font-semibold text-white">Pool {pool.letter}</p>
                    {courtLabel && (
                      <p className="text-xs text-zinc-400">{courtLabel}</p>
                    )}
                  </div>
                  {(() => {
                    const standings = calculatePoolStandings(
                      teams.map((t) => t.id),
                      games
                    );
                    const anyPlayed = standings.some((s) => s.played > 0);
                    return (
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-wider text-zinc-500">
                            <th className="px-4 py-1.5 text-left font-medium">
                              {anyPlayed ? "#" : "Seed"}
                            </th>
                            <th className="py-1.5 text-left font-medium">Team</th>
                            <th className="py-1.5 text-right font-medium">W-L</th>
                            <th className="px-4 py-1.5 text-right font-medium">Diff</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800">
                          {standings.map((s) => {
                            const t = teamById.get(s.team_id);
                            const tieLabel = tiebreakerLabel(s.decidedBy);
                            return (
                              <tr key={s.team_id}>
                                <td className="px-4 py-1.5 text-zinc-500">
                                  {anyPlayed ? s.place : t?.pool_seed ?? "—"}
                                </td>
                                <td className="py-1.5 text-zinc-200">
                                  {teamLabel(t as (Team & { players: Player[] }) | undefined)}
                                  {tieLabel && (
                                    <span
                                      className="ml-1.5 inline-block rounded bg-amber-950/60 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300"
                                      title={`Tiebreaker: ${tieLabel}`}
                                    >
                                      {tieLabel}
                                    </span>
                                  )}
                                </td>
                                <td className="py-1.5 text-right text-zinc-300 tabular-nums">
                                  {anyPlayed ? `${s.wins}-${s.losses}` : "—"}
                                </td>
                                <td
                                  className={`px-4 py-1.5 text-right tabular-nums ${
                                    s.diff > 0
                                      ? "text-emerald-400"
                                      : s.diff < 0
                                        ? "text-red-400"
                                        : "text-zinc-500"
                                  }`}
                                >
                                  {anyPlayed ? (s.diff > 0 ? `+${s.diff}` : s.diff) : "—"}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    );
                  })()}
                  <div className="border-t border-zinc-800 bg-zinc-950/40 px-4 py-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Round-robin ({games.length} games)
                    </p>
                    <ul className="space-y-1.5 text-xs">
                      {games.map((g) => {
                        const a = teamById.get(g.team_a_id ?? "");
                        const b = teamById.get(g.team_b_id ?? "");
                        const aLabel = teamLabel(a);
                        const bLabel = teamLabel(b);
                        const hasScore = g.score_a != null && g.score_b != null;
                        const canEnter = !!a && !!b && !!format;
                        return (
                          <li
                            key={g.id}
                            className="flex items-center justify-between gap-2 rounded-md px-1 py-1 hover:bg-zinc-900/60"
                          >
                            <span className="text-zinc-500">R{g.round}</span>
                            <span className="min-w-0 flex-1 truncate text-zinc-200">
                              {aLabel} <span className="text-zinc-500">vs</span> {bLabel}
                            </span>
                            {hasScore ? (
                              <button
                                type="button"
                                disabled={!canEnter}
                                onClick={() =>
                                  canEnter &&
                                  onOpenGame({
                                    id: g.id,
                                    stage: g.stage,
                                    team_a_label: aLabel,
                                    team_b_label: bLabel,
                                    score_a: g.score_a,
                                    score_b: g.score_b,
                                    format,
                                    pool_letter: pool.letter,
                                  })
                                }
                                className="rounded-md bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-emerald-300 hover:bg-zinc-700 disabled:opacity-50"
                                title="Edit score"
                              >
                                {g.score_a}–{g.score_b}
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={!canEnter}
                                onClick={() =>
                                  canEnter &&
                                  onOpenGame({
                                    id: g.id,
                                    stage: g.stage,
                                    team_a_label: aLabel,
                                    team_b_label: bLabel,
                                    score_a: g.score_a,
                                    score_b: g.score_b,
                                    format,
                                    pool_letter: pool.letter,
                                  })
                                }
                                className="rounded-md border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-[10px] text-zinc-300 hover:border-emerald-700 hover:text-emerald-300 disabled:opacity-50"
                              >
                                Enter score
                              </button>
                            )}
                            {g.court_id && (
                              <span className="text-[10px] text-zinc-500">
                                {courtBadge(courtById.get(g.court_id))}
                              </span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              );
            })}
        </div>
      )}

      {hasPools && (() => {
        const poolGamesAll = category.games.filter((g) => g.stage === "pool");
        const poolPlayComplete =
          poolGamesAll.length > 0 &&
          poolGamesAll.every((g) => g.score_a != null && g.score_b != null);
        const bracketGames = category.games
          .filter((g) => g.stage !== "pool")
          .sort((a, b) => a.round - b.round || a.sort_order - b.sort_order);
        const hasBracket = bracketGames.length > 0;

        if (!poolPlayComplete && !hasBracket) {
          return (
            <div className="border-t border-zinc-800 px-5 py-4 text-xs text-zinc-500">
              The bracket can be seeded once every pool game has a recorded score.
            </div>
          );
        }
        return (
          <div className="border-t border-zinc-800 bg-zinc-950/40 px-5 py-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                Bracket
              </h4>
              <div className="flex flex-wrap gap-2">
                {hasBracket ? (
                  <>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => seedBracket(true)}
                      className="rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-200 hover:border-zinc-700 disabled:opacity-60"
                    >
                      Re-seed
                    </button>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={clearBracket}
                      className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-1.5 text-xs text-red-300 hover:bg-red-950/50 disabled:opacity-60"
                    >
                      Clear
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={pending}
                    onClick={() => seedBracket(false)}
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {pending ? "Seeding…" : "Seed bracket"}
                  </button>
                )}
              </div>
            </div>
            {hasBracket && (
              <BracketGrid
                games={bracketGames}
                teamById={teamById}
                teamLabel={teamLabel}
                format={format}
                onOpenGame={onOpenGame}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}

function BracketGrid({
  games,
  teamById,
  teamLabel,
  format,
  onOpenGame,
}: {
  games: Game[];
  teamById: Map<string, Team & { players: Player[] }>;
  teamLabel: (t: (Team & { players: Player[] }) | undefined) => string;
  format: TournamentFormat | null;
  onOpenGame: (g: WorksheetGame) => void;
}) {
  const byStage = new Map<"qf" | "sf" | "f", Game[]>();
  for (const g of games) {
    if (g.stage === "pool") continue;
    const arr = byStage.get(g.stage) ?? [];
    arr.push(g);
    byStage.set(g.stage, arr);
  }
  const allStages: { key: "qf" | "sf" | "f"; label: string }[] = [
    { key: "qf", label: "Quarterfinals" },
    { key: "sf", label: "Semifinals" },
    { key: "f", label: "Final" },
  ];
  const stages = allStages.filter((s) => (byStage.get(s.key) ?? []).length > 0);

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {stages.map((stage) => {
        const stageGames = (byStage.get(stage.key) ?? []).sort(
          (a, b) => a.sort_order - b.sort_order
        );
        return (
          <div key={stage.key} className="space-y-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
              {stage.label}
            </p>
            {stageGames.map((g) => {
              const a = teamById.get(g.team_a_id ?? "");
              const b = teamById.get(g.team_b_id ?? "");
              const aLabel = a ? teamLabel(a) : "—";
              const bLabel = b ? teamLabel(b) : "—";
              const hasScore = g.score_a != null && g.score_b != null;
              const canEnter = !!a && !!b && !!format;
              const aWon = hasScore && (g.score_a as number) > (g.score_b as number);
              return (
                <button
                  key={g.id}
                  type="button"
                  disabled={!canEnter}
                  onClick={() =>
                    canEnter &&
                    onOpenGame({
                      id: g.id,
                      stage: g.stage as "qf" | "sf" | "f",
                      team_a_label: aLabel,
                      team_b_label: bLabel,
                      score_a: g.score_a,
                      score_b: g.score_b,
                      format,
                      pool_letter: null,
                    })
                  }
                  className="block w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-left text-xs hover:border-emerald-700 disabled:cursor-default disabled:hover:border-zinc-800"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        hasScore && aWon ? "font-semibold text-white" : "text-zinc-300"
                      } ${!a ? "italic text-zinc-500" : ""}`}
                    >
                      {aLabel}
                    </span>
                    {hasScore && (
                      <span className="tabular-nums text-emerald-300">{g.score_a}</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center justify-between gap-2">
                    <span
                      className={`min-w-0 flex-1 truncate ${
                        hasScore && !aWon ? "font-semibold text-white" : "text-zinc-300"
                      } ${!b ? "italic text-zinc-500" : ""}`}
                    >
                      {bLabel}
                    </span>
                    {hasScore && (
                      <span className="tabular-nums text-emerald-300">{g.score_b}</span>
                    )}
                  </div>
                  {!hasScore && canEnter && (
                    <p className="mt-1 text-[10px] text-emerald-400">Enter score →</p>
                  )}
                </button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

function courtBadge(c: TournamentCourt | undefined): string {
  if (!c) return "";
  return c.name ? `Court ${c.number} — ${c.name}` : `Court ${c.number}`;
}

void (null as unknown as CategoryType);
