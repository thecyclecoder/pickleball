import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { calculatePoolStandings } from "@/lib/standings";
import { computeBracketSeeding } from "@/lib/bracket-seed";
import type { Game } from "@/lib/types";

/**
 * Seed (or re-seed) the elimination bracket for a category.
 *
 * Pre-conditions:
 *   • Pool play in this category must be COMPLETE — every pool-stage
 *     game has a recorded score. Otherwise we'd be seeding off a
 *     half-built standings table.
 *   • The category must reference a tournament_format (so we know
 *     whether the bracket has QF or starts at SF).
 *   • advance_per_pool must equal 2 (current bracket-seeder limit).
 *
 * Re-seeding: any existing bracket games (qf/sf/f) for the category
 * are wiped first. We do NOT touch pool-stage games.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, catId } = await params;
  const admin = createAdminClient();

  const { data: tournament } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data: category } = await admin
    .from("tournament_categories")
    .select(
      `id, advance_per_pool, format_id,
       format:tournament_formats (
         has_quarterfinals, pool_play_advance_per_pool
       ),
       pools:tournament_pools ( id, letter, sort_order ),
       teams ( id, pool_id ),
       games ( * )`
    )
    .eq("id", catId)
    .eq("tournament_id", id)
    .maybeSingle();
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  type CategoryRow = {
    id: string;
    advance_per_pool: number | null;
    format_id: string | null;
    format: { has_quarterfinals: boolean; pool_play_advance_per_pool: number } | null;
    pools: { id: string; letter: string; sort_order: number }[];
    teams: { id: string; pool_id: string | null }[];
    games: Game[];
  };
  const cat = category as unknown as CategoryRow;

  if (!cat.format) {
    return NextResponse.json(
      { error: "Category has no tournament_format set" },
      { status: 400 }
    );
  }

  const advance =
    cat.advance_per_pool ?? cat.format.pool_play_advance_per_pool ?? 2;

  // Pool play must be complete — every pool game has both scores.
  const poolGames = cat.games.filter((g) => g.stage === "pool");
  if (poolGames.length === 0) {
    return NextResponse.json(
      { error: "No pool games yet — generate pools and play them first" },
      { status: 400 }
    );
  }
  const incomplete = poolGames.filter(
    (g) => g.score_a == null || g.score_b == null
  );
  if (incomplete.length > 0) {
    return NextResponse.json(
      {
        error: `Pool play isn't complete — ${incomplete.length} game${
          incomplete.length === 1 ? "" : "s"
        } still need a score before the bracket can seed.`,
      },
      { status: 400 }
    );
  }

  // Build per-pool standings using the already-implemented calculator.
  const teamsByPool = new Map<string, string[]>();
  for (const t of cat.teams) {
    if (!t.pool_id) continue;
    const arr = teamsByPool.get(t.pool_id) ?? [];
    arr.push(t.id);
    teamsByPool.set(t.pool_id, arr);
  }
  const sortedPools = [...cat.pools].sort((a, b) => a.sort_order - b.sort_order);
  const poolsForBracket = sortedPools.map((pool) => {
    const ids = teamsByPool.get(pool.id) ?? [];
    const games = poolGames.filter((g) => g.pool_id === pool.id);
    const rows = calculatePoolStandings(ids, games);
    return { poolLetter: pool.letter, rows };
  });

  let plan;
  try {
    plan = computeBracketSeeding({
      pools: poolsForBracket,
      advancePerPool: advance,
      hasQuarterfinals: cat.format.has_quarterfinals,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to compute bracket" },
      { status: 400 }
    );
  }

  // Wipe existing bracket games for the category (keep pool games).
  const { error: delErr } = await admin
    .from("games")
    .delete()
    .eq("category_id", catId)
    .in("stage", ["qf", "sf", "f"]);
  if (delErr) {
    return NextResponse.json({ error: delErr.message }, { status: 500 });
  }

  const inserts = plan.games.map((g) => ({
    category_id: catId,
    pool_id: null,
    stage: g.stage,
    round: g.round,
    sort_order: g.sort_order,
    team_a_id: g.team_a_id,
    team_b_id: g.team_b_id,
  }));
  const { error: insErr } = await admin.from("games").insert(inserts);
  if (insErr) {
    return NextResponse.json({ error: insErr.message }, { status: 500 });
  }

  return NextResponse.json({
    bracket: plan.games.length,
    tier1: plan.tier1.map((t) => ({
      team_id: t.team_id,
      poolLetter: t.poolLetter,
      overallRank: t.overallRank,
    })),
    tier2: plan.tier2.map((t) => ({
      team_id: t.team_id,
      poolLetter: t.poolLetter,
      overallRank: t.overallRank,
    })),
  });
}

/** DELETE — wipe the bracket games (qf/sf/f) for this category. Pool
 *  games are untouched. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, catId } = await params;
  const admin = createAdminClient();

  const { data: t } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await admin
    .from("games")
    .delete()
    .eq("category_id", catId)
    .in("stage", ["qf", "sf", "f"]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
