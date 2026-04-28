"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { categoryLabel } from "@/lib/categories";
import type {
  CategoryType,
  Game,
  Player,
  Team,
  TournamentCategory,
  TournamentCourt,
  TournamentPool,
} from "@/lib/types";

type CategoryView = TournamentCategory & {
  pools: TournamentPool[];
  teams: (Team & { players: Player[] })[];
  games: Game[];
};

export function PoolsPanel({
  tournamentId,
  categories,
  courts,
}: {
  tournamentId: string;
  categories: CategoryView[];
  courts: TournamentCourt[];
}) {
  const courtById = new Map(courts.map((c) => [c.id, c]));

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
        />
      ))}
    </section>
  );
}

function CategoryPools({
  tournamentId,
  category,
  courtById,
}: {
  tournamentId: string;
  category: CategoryView;
  courtById: Map<string, TournamentCourt>;
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
                  <ul className="divide-y divide-zinc-800 text-xs">
                    {teams.map((t) => (
                      <li
                        key={t.id}
                        className="flex items-center justify-between gap-2 px-4 py-2"
                      >
                        <span className="text-zinc-200">
                          <span className="mr-2 text-zinc-500">#{t.pool_seed}</span>
                          {teamLabel(t)}
                        </span>
                        <span className="text-zinc-500">Seed {t.seed}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-zinc-800 bg-zinc-950/40 px-4 py-3">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                      Round-robin ({games.length} games)
                    </p>
                    <ul className="space-y-1.5 text-xs">
                      {games.map((g) => {
                        const a = teamById.get(g.team_a_id ?? "");
                        const b = teamById.get(g.team_b_id ?? "");
                        return (
                          <li key={g.id} className="flex items-center justify-between gap-2">
                            <span className="text-zinc-500">R{g.round}</span>
                            <span className="min-w-0 flex-1 truncate text-zinc-200">
                              {teamLabel(a)} <span className="text-zinc-500">vs</span>{" "}
                              {teamLabel(b)}
                            </span>
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
    </div>
  );
}

function courtBadge(c: TournamentCourt | undefined): string {
  if (!c) return "";
  return c.name ? `Court ${c.number} — ${c.name}` : `Court ${c.number}`;
}

void (null as unknown as CategoryType);
