/**
 * Pool play generation: snake-seed by combined player rating, then
 * round-robin within each pool, with court assignment.
 *
 * Snake seed (a.k.a. serpentine): the top tier of teams (one per pool)
 * are seed 1s, the next tier (one per pool) are seed 2s, etc. Within
 * each tier the assignment direction reverses so the total combined
 * rating across pools comes out roughly equal — it's not enough to
 * just "spread the top 4", we also have to balance the bottom 4 so
 * Pool A doesn't end up with the strongest *and* weakest teams.
 *
 * Round-robin uses the circle / Berger method: each team plays each
 * other team exactly once, organized into rounds where every team
 * plays at most once per round (so the schedule can run in parallel
 * across courts without anyone playing back-to-back).
 */

export const POOL_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;

export type SeedInputTeam = {
  id: string;
  combined_rating: number;
};

export type SeededPool = SeedInputTeam[];

/**
 * Distribute teams across `poolCount` pools using snake seeding.
 *
 *   16 teams / 4 pools →
 *     Pool A: seeds 1, 8,  9, 16
 *     Pool B: seeds 2, 7, 10, 15
 *     Pool C: seeds 3, 6, 11, 14
 *     Pool D: seeds 4, 5, 12, 13
 *
 * Returns one array per pool, each in pool-seed order (1..N inside the
 * pool — so pools[0][0] is the pool's #1 seed).
 */
export function snakeSeed(
  teams: SeedInputTeam[],
  poolCount: number
): SeededPool[] {
  if (poolCount < 1) throw new Error("poolCount must be >= 1");
  const sorted = [...teams].sort(
    (a, b) => b.combined_rating - a.combined_rating
  );
  const pools: SeededPool[] = Array.from({ length: poolCount }, () => []);
  for (let i = 0; i < sorted.length; i++) {
    const round = Math.floor(i / poolCount);
    const slot = i % poolCount;
    // Even rounds go forward (A→D), odd rounds reverse (D→A) so the
    // top-tier and bottom-tier are anti-correlated within each pool.
    const poolIdx = round % 2 === 0 ? slot : poolCount - 1 - slot;
    pools[poolIdx].push(sorted[i]);
  }
  return pools;
}

/**
 * Round-robin pairings using the circle method. Returns games keyed
 * by pool-internal indices (0..n-1) and round (0-indexed).
 *
 * For n=4: 3 rounds, 6 games total. Each round contains 2 games, and
 * each team plays in every round.
 */
export function roundRobinPairs(
  teamCount: number
): { round: number; aIdx: number; bIdx: number }[] {
  const games: { round: number; aIdx: number; bIdx: number }[] = [];
  if (teamCount < 2) return games;

  // Pad to even with a "bye" sentinel index so the rotation works
  // cleanly. Bye-paired games are filtered out.
  const padded = teamCount % 2 === 0 ? teamCount : teamCount + 1;
  const slots = Array.from({ length: padded }, (_, i) => i);

  for (let round = 0; round < padded - 1; round++) {
    for (let i = 0; i < padded / 2; i++) {
      const a = slots[i];
      const b = slots[padded - 1 - i];
      if (a < teamCount && b < teamCount) {
        games.push({ round, aIdx: a, bIdx: b });
      }
    }
    // Rotate keeping slot[0] fixed: take the last entry, splice into
    // position 1. Standard circle-method rotation.
    const last = slots.pop();
    if (last !== undefined) slots.splice(1, 0, last);
  }
  return games;
}

export type ScheduledGame = {
  pool_letter: string;
  round: number; // 1-indexed for display
  team_a_id: string;
  team_b_id: string;
  court_id: string | null;
  sort_order: number;
};

/**
 * Combine the seeded pools + the round-robin pairings + court list
 * into a flat list of games ready for insertion. When poolCount ≤
 * courtCount we dedicate one court per pool (simplest/clearest for
 * players: "Pool A is on Court 1, Pool B on Court 2"); otherwise the
 * pool-to-court mapping wraps modulo the court count.
 */
export function buildSchedule(args: {
  pools: { letter: string; teams: SeededPool }[];
  courts: { id: string }[];
}): ScheduledGame[] {
  const games: ScheduledGame[] = [];
  let order = 0;

  // Map each pool to a primary court (or null if no courts configured).
  const poolToCourt = new Map<string, string | null>();
  args.pools.forEach((p, i) => {
    if (args.courts.length === 0) {
      poolToCourt.set(p.letter, null);
    } else {
      poolToCourt.set(p.letter, args.courts[i % args.courts.length].id);
    }
  });

  for (const pool of args.pools) {
    const pairs = roundRobinPairs(pool.teams.length);
    for (const pair of pairs) {
      games.push({
        pool_letter: pool.letter,
        round: pair.round + 1,
        team_a_id: pool.teams[pair.aIdx].id,
        team_b_id: pool.teams[pair.bIdx].id,
        court_id: poolToCourt.get(pool.letter) ?? null,
        sort_order: order++,
      });
    }
  }

  return games;
}
