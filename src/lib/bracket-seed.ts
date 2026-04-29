// Bracket seeding for elimination rounds.
//
// After pool play wraps up, this turns the per-pool standings into a
// concrete set of bracket games (QF/SF/F).
//
// Rules:
//   • Re-rank ALL pool winners (1st place finishers across pools) into
//     a single "tier 1" ranking. Same for runners-up → "tier 2".
//   • QF pairings cross-pool: best winner faces worst runner-up that
//     ISN'T from their own pool. We brute-force permutations to find a
//     conflict-free assignment, scoring by deviation from the natural
//     "best-vs-worst" pairing so we still respect re-rank ordering.
//   • Bracket placement spreads the top two re-ranked winners onto
//     opposite halves so #1 and #2 only meet in the final. For 8-team
//     brackets we lay out QFs as [W1's match, W4's match, W3's match,
//     W2's match] — top half = QF1+QF2, bottom half = QF3+QF4.
//
// Supported configs (by team count entering the bracket = pools × advance):
//   • 8 teams (QF + SF + F) — has_quarterfinals = true, e.g. 4 pools × 2
//   • 4 teams (SF + F) — has_quarterfinals = false, e.g. 2 pools × 2
//
// Other sizes throw — sufficient for the tournaments we run today; we
// can extend when a larger field shows up.

import type { StandingRow } from "./standings";

export type PoolStandingForBracket = {
  poolLetter: string;
  /** Pool standings already sorted by place (1st, 2nd, …). */
  rows: StandingRow[];
};

export type SeededTeam = {
  team_id: string;
  poolLetter: string;
  poolPlace: number;
  /** 1-indexed cross-pool rank within this tier. */
  overallRank: number;
  /** Same fields as StandingRow for downstream display + tiebreaks. */
  wins: number;
  losses: number;
  diff: number;
  pointsFor: number;
  pointsAgainst: number;
};

export type BracketGame = {
  stage: "qf" | "sf" | "f";
  /** 1-indexed round counted within the bracket (qf=1, sf=2, f=3 for
   *  8-team; sf=1, f=2 for 4-team). Used by the UI to draw columns. */
  round: number;
  /** Position within the round, 0-indexed. Encodes bracket lineage:
   *  QF[i].winner → SF[floor(i/2)].team_(i%2==0 ? a : b);
   *  SF[i].winner → F.team_(i==0 ? a : b). */
  sort_order: number;
  team_a_id: string | null;
  team_b_id: string | null;
};

export type BracketPlan = {
  tier1: SeededTeam[];
  tier2: SeededTeam[];
  games: BracketGame[];
};

function toSeeded(
  row: StandingRow,
  poolLetter: string,
  poolPlace: number,
  overallRank: number
): SeededTeam {
  return {
    team_id: row.team_id,
    poolLetter,
    poolPlace,
    overallRank,
    wins: row.wins,
    losses: row.losses,
    diff: row.diff,
    pointsFor: row.pointsFor,
    pointsAgainst: row.pointsAgainst,
  };
}

/** Re-rank a tier (all the 1st-place finishers, or all the 2nd-place
 *  finishers) across pools. No H2H to use since these teams haven't
 *  played each other; cascade collapses to W-L → losses → diff →
 *  total points. */
function rerankTier(tier: SeededTeam[]): SeededTeam[] {
  const sorted = [...tier].sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (a.losses !== b.losses) return a.losses - b.losses;
    if (b.diff !== a.diff) return b.diff - a.diff;
    return b.pointsFor - a.pointsFor;
  });
  return sorted.map((s, i) => ({ ...s, overallRank: i + 1 }));
}

function* permutations(n: number): Generator<number[]> {
  const arr = Array.from({ length: n }, (_, i) => i);
  function* rec(prefix: number[], remaining: number[]): Generator<number[]> {
    if (remaining.length === 0) {
      yield prefix;
      return;
    }
    for (let i = 0; i < remaining.length; i++) {
      const next = remaining[i];
      const rest = [...remaining.slice(0, i), ...remaining.slice(i + 1)];
      yield* rec([...prefix, next], rest);
    }
  }
  yield* rec([], arr);
}

/** Pair winners (best-first) with runners-up (worst-first), avoiding
 *  same-pool matchups. Falls back to natural pairing with a rematch
 *  only if no conflict-free assignment exists (shouldn't happen for
 *  the supported sizes given >1 pool, but guarded anyway). */
function pairCrossPool(
  winners: SeededTeam[],
  runnersWorstFirst: SeededTeam[]
): { winner: SeededTeam; runner: SeededTeam; rematch: boolean }[] {
  const n = winners.length;
  let best: number[] | null = null;
  let bestDev = Infinity;
  for (const perm of permutations(n)) {
    const valid = winners.every(
      (w, i) => w.poolLetter !== runnersWorstFirst[perm[i]].poolLetter
    );
    if (!valid) continue;
    const dev = perm.reduce((s, p, i) => s + Math.abs(p - i), 0);
    if (dev < bestDev) {
      best = [...perm];
      bestDev = dev;
      if (dev === 0) break;
    }
  }
  if (best) {
    return winners.map((w, i) => ({
      winner: w,
      runner: runnersWorstFirst[best![i]],
      rematch: false,
    }));
  }
  // Unavoidable rematch — natural order, flag each pair
  return winners.map((w, i) => ({
    winner: w,
    runner: runnersWorstFirst[i],
    rematch: w.poolLetter === runnersWorstFirst[i].poolLetter,
  }));
}

export function computeBracketSeeding(opts: {
  pools: PoolStandingForBracket[];
  advancePerPool: number;
  hasQuarterfinals: boolean;
}): BracketPlan {
  const { pools, advancePerPool, hasQuarterfinals } = opts;

  if (advancePerPool !== 2) {
    throw new Error("Bracket seeding currently supports advance_per_pool = 2 only");
  }
  if (pools.length < 2) {
    throw new Error("Need at least 2 pools to seed a bracket");
  }
  for (const p of pools) {
    if (p.rows.length < advancePerPool) {
      throw new Error(
        `Pool ${p.poolLetter} only has ${p.rows.length} ranked teams (need ${advancePerPool})`
      );
    }
  }

  const winnersInitial = pools.map((p) => toSeeded(p.rows[0], p.poolLetter, 1, 0));
  const runnersInitial = pools.map((p) => toSeeded(p.rows[1], p.poolLetter, 2, 0));
  const tier1 = rerankTier(winnersInitial);
  const tier2 = rerankTier(runnersInitial);

  const teamsInBracket = tier1.length + tier2.length;
  const runnersWorstFirst = [...tier2].reverse();
  const pairs = pairCrossPool(tier1, runnersWorstFirst);

  const games: BracketGame[] = [];

  if (hasQuarterfinals && teamsInBracket === 8) {
    // 8-team bracket: QF1 = W1's match, QF2 = W4's match, QF3 = W3's
    // match, QF4 = W2's match. Top half = QF1+QF2, bottom half = QF3+QF4.
    const qfWinnerOrder = [0, 3, 2, 1]; // tier1 indexes in QF slot order
    qfWinnerOrder.forEach((wIdx, qfIdx) => {
      const pair = pairs.find((p) => p.winner.team_id === tier1[wIdx].team_id)!;
      games.push({
        stage: "qf",
        round: 1,
        sort_order: qfIdx,
        team_a_id: pair.winner.team_id,
        team_b_id: pair.runner.team_id,
      });
    });
    games.push({ stage: "sf", round: 2, sort_order: 0, team_a_id: null, team_b_id: null });
    games.push({ stage: "sf", round: 2, sort_order: 1, team_a_id: null, team_b_id: null });
    games.push({ stage: "f", round: 3, sort_order: 0, team_a_id: null, team_b_id: null });
    return { tier1, tier2, games };
  }

  if (!hasQuarterfinals && teamsInBracket === 4) {
    // 4-team bracket: skip QF, go straight to SF.
    // SF1 = W1's match (top half); SF2 = W2's match (bottom half).
    const sfWinnerOrder = [0, 1];
    sfWinnerOrder.forEach((wIdx, sfIdx) => {
      const pair = pairs.find((p) => p.winner.team_id === tier1[wIdx].team_id)!;
      games.push({
        stage: "sf",
        round: 1,
        sort_order: sfIdx,
        team_a_id: pair.winner.team_id,
        team_b_id: pair.runner.team_id,
      });
    });
    games.push({ stage: "f", round: 2, sort_order: 0, team_a_id: null, team_b_id: null });
    return { tier1, tier2, games };
  }

  throw new Error(
    `Unsupported bracket configuration: ${pools.length} pools × ${advancePerPool} = ${teamsInBracket} teams, has_quarterfinals=${hasQuarterfinals}`
  );
}

/** Map a completed bracket game's sort_order to the next-stage slot it
 *  feeds. Returns null for the final (no further stage). The boolean
 *  indicates whether the winner goes into team_a (true) or team_b (false)
 *  of the next-stage game. */
export function nextBracketSlot(
  stage: "qf" | "sf",
  sortOrder: number
): { nextStage: "sf" | "f"; nextSortOrder: number; intoSlot: "a" | "b" } {
  if (stage === "qf") {
    // QF[0] → SF[0].a; QF[1] → SF[0].b; QF[2] → SF[1].a; QF[3] → SF[1].b
    const nextSortOrder = Math.floor(sortOrder / 2);
    const intoSlot: "a" | "b" = sortOrder % 2 === 0 ? "a" : "b";
    return { nextStage: "sf", nextSortOrder, intoSlot };
  }
  // SF[0] → F.a; SF[1] → F.b
  return {
    nextStage: "f",
    nextSortOrder: 0,
    intoSlot: sortOrder === 0 ? "a" : "b",
  };
}
