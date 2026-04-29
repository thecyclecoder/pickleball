// Pool standings + tiebreaker ladder.
//
// Cascade (per spec):
//   1. Win-Loss
//   2. Head-to-head wins among the tied subset
//   3. Point differential among the tied subset (just the games between
//      the tied teams)
//   4. Overall pool point differential
//   5. Total points scored
//   6. Manual (still tied — admin decides)
//
// For a 2-way tie this collapses naturally: the H2H game IS the only
// shared game, so step 2 either resolves it (one team won) or — only if
// they haven't met yet — falls through to overall stats. For 3+ tied
// teams, step 2 (H2H wins) and step 3 (H2H point diff) operate on the
// subset of games played among the tied teams.
//
// `decidedBy` is annotated on each row so the UI can show *why* a team
// landed where it did when there was a tie. Rows without a tie carry
// `decidedBy: undefined` (no annotation needed).

import type { Game } from "./types";

export type TiebreakerReason = "h2h" | "tied_diff" | "overall_diff" | "points" | "manual";

export type StandingRow = {
  team_id: string;
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  diff: number;
  place: number;
  /** Set only when this row's position required a tiebreaker (so the
   *  W-L group it sits in had >1 member). The reason names the rung of
   *  the cascade that broke the tie. */
  decidedBy?: TiebreakerReason;
};

type Stats = {
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
};

function isCompleted(g: Game): boolean {
  return g.score_a != null && g.score_b != null && !!g.team_a_id && !!g.team_b_id;
}

export function calculatePoolStandings(teamIds: string[], games: Game[]): StandingRow[] {
  const teamSet = new Set(teamIds);
  const stats = new Map<string, Stats>();
  for (const id of teamIds) {
    stats.set(id, { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0 });
  }

  const completed = games.filter(
    (g) =>
      isCompleted(g) &&
      g.team_a_id &&
      g.team_b_id &&
      teamSet.has(g.team_a_id) &&
      teamSet.has(g.team_b_id)
  );

  for (const g of completed) {
    const a = stats.get(g.team_a_id!);
    const b = stats.get(g.team_b_id!);
    if (!a || !b) continue;
    const sa = g.score_a as number;
    const sb = g.score_b as number;
    a.played++;
    b.played++;
    a.pointsFor += sa;
    a.pointsAgainst += sb;
    b.pointsFor += sb;
    b.pointsAgainst += sa;
    if (sa > sb) {
      a.wins++;
      b.losses++;
    } else {
      a.losses++;
      b.wins++;
    }
  }

  const rows: StandingRow[] = teamIds.map((id) => {
    const s = stats.get(id)!;
    return {
      team_id: id,
      played: s.played,
      wins: s.wins,
      losses: s.losses,
      pointsFor: s.pointsFor,
      pointsAgainst: s.pointsAgainst,
      diff: s.pointsFor - s.pointsAgainst,
      place: 0,
    };
  });

  // Step 1: by wins desc, then losses asc — two teams are only "tied" if
  // they share the exact same record. A 0-0 team isn't tied with a 0-1
  // team just because both have 0 wins; the 0-0 team ranks higher.
  rows.sort((a, b) => b.wins - a.wins || a.losses - b.losses);

  // Group by full record; resolve each tied group via the cascade
  const sorted: StandingRow[] = [];
  for (const group of groupBy(rows, (r) => `${r.wins}-${r.losses}`)) {
    if (group.length === 1) {
      sorted.push(group[0]);
    } else {
      sorted.push(...resolveTiedGroup(group, completed));
    }
  }

  sorted.forEach((r, i) => {
    r.place = i + 1;
  });
  return sorted;
}

function resolveTiedGroup(group: StandingRow[], allGames: Game[]): StandingRow[] {
  const tiedIds = new Set(group.map((r) => r.team_id));

  // H2H stats restricted to games between tied teams
  const h2h = new Map<string, { wins: number; diff: number; played: number }>();
  for (const id of tiedIds) h2h.set(id, { wins: 0, diff: 0, played: 0 });

  for (const g of allGames) {
    if (!g.team_a_id || !g.team_b_id) continue;
    if (!tiedIds.has(g.team_a_id) || !tiedIds.has(g.team_b_id)) continue;
    const sa = g.score_a as number;
    const sb = g.score_b as number;
    const a = h2h.get(g.team_a_id)!;
    const b = h2h.get(g.team_b_id)!;
    a.played++;
    b.played++;
    a.diff += sa - sb;
    b.diff += sb - sa;
    if (sa > sb) a.wins++;
    else b.wins++;
  }

  // Cascade: H2H wins → H2H diff → overall diff → total points → manual.
  // Each step subdivides the still-tied subgroups; resolved subgroups
  // (size 1) get tagged with the rung that broke them.
  return cascade(group, [
    {
      reason: "h2h",
      key: (r) => h2h.get(r.team_id)!.wins,
    },
    {
      reason: "tied_diff",
      key: (r) => h2h.get(r.team_id)!.diff,
    },
    {
      reason: "overall_diff",
      key: (r) => r.diff,
    },
    {
      reason: "points",
      key: (r) => r.pointsFor,
    },
  ]);
}

type CascadeStep = {
  reason: TiebreakerReason;
  /** Higher is better — sort descending by this key. */
  key: (r: StandingRow) => number;
};

function cascade(group: StandingRow[], steps: CascadeStep[]): StandingRow[] {
  if (steps.length === 0) {
    // Every rung exhausted; remaining ties are manual.
    for (const r of group) r.decidedBy = "manual";
    return group;
  }
  const [step, ...rest] = steps;
  const sorted = [...group].sort((a, b) => step.key(b) - step.key(a));
  const out: StandingRow[] = [];
  for (const sub of groupBy(sorted, step.key)) {
    if (sub.length === 1) {
      sub[0].decidedBy = step.reason;
      out.push(sub[0]);
    } else {
      out.push(...cascade(sub, rest));
    }
  }
  return out;
}

/** Splits `arr` into runs of consecutive items sharing `key`. Assumes
 *  `arr` is already sorted by that key. */
function groupBy<T>(arr: T[], key: (t: T) => number | string): T[][] {
  const groups: T[][] = [];
  let cur: T[] = [];
  let curKey: number | string | null = null;
  for (const item of arr) {
    const k = key(item);
    if (cur.length === 0 || k !== curKey) {
      if (cur.length) groups.push(cur);
      cur = [item];
      curKey = k;
    } else {
      cur.push(item);
    }
  }
  if (cur.length) groups.push(cur);
  return groups;
}

export function tiebreakerLabel(reason: TiebreakerReason | undefined): string | null {
  if (!reason) return null;
  if (reason === "h2h") return "H2H";
  if (reason === "tied_diff") return "Diff vs tied";
  if (reason === "overall_diff") return "Pool diff";
  if (reason === "points") return "Total pts";
  return "Manual";
}
