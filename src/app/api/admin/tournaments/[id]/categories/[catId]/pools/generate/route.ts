import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import {
  POOL_LETTERS,
  buildSchedule,
  snakeSeed,
  type SeedInputTeam,
} from "@/lib/pool-generator";

/**
 * Generate (or regenerate) pools + round-robin games for a category.
 *
 * Idempotent: any existing pools/games for the category are wiped first
 * so the result is deterministic for the current set of active teams.
 * Cancelled and waitlisted teams are excluded — only `registered` and
 * `confirmed` teams seed into pools.
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
    .select("id, pool_count")
    .eq("id", catId)
    .eq("tournament_id", id)
    .maybeSingle();
  if (!category) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }

  // Active teams + their players (for combined rating)
  type RawTeam = {
    id: string;
    status: string;
    players: { rating: number | string }[];
  };
  const { data: rawTeams } = await admin
    .from("teams")
    .select("id, status, players (rating)")
    .eq("category_id", catId)
    .in("status", ["registered", "confirmed"]);

  const teams: SeedInputTeam[] = ((rawTeams ?? []) as unknown as RawTeam[]).map((t) => ({
    id: t.id,
    combined_rating: (t.players ?? []).reduce(
      (sum, p) => sum + Number(p.rating),
      0
    ),
  }));

  if (teams.length < 2) {
    return NextResponse.json(
      { error: "Need at least 2 active (non-waitlisted, non-cancelled) teams to generate pools" },
      { status: 400 }
    );
  }

  // Pool count: respect the category setting if present, else infer
  // from team count (4 pools when ≥8 teams, 2 pools when ≥4, else 1).
  let poolCount = category.pool_count ?? null;
  if (!poolCount) {
    poolCount = teams.length >= 8 ? 4 : teams.length >= 4 ? 2 : 1;
  }
  poolCount = Math.min(poolCount, teams.length, POOL_LETTERS.length);

  // Courts on the tournament — pool-to-court mapping is one court per
  // pool when poolCount ≤ courtCount, otherwise wraps modulo.
  const { data: courtRows } = await admin
    .from("tournament_courts")
    .select("id, sort_order, number")
    .eq("tournament_id", id)
    .order("sort_order", { ascending: true })
    .order("number", { ascending: true });
  const courts = (courtRows ?? []) as { id: string; sort_order: number; number: number }[];

  // Wipe existing pools + games + team assignments for a clean regen.
  // Games cascade-delete from pools (via the FK on_delete cascade), but
  // we delete games first explicitly so the rows tied to old pool_ids
  // can also be removed cleanly.
  await admin.from("games").delete().eq("category_id", catId);
  await admin.from("tournament_pools").delete().eq("category_id", catId);
  await admin
    .from("teams")
    .update({ pool_id: null, seed: null, pool_seed: null })
    .eq("category_id", catId);

  // Insert pool rows — letters in seeding order.
  const poolInserts = Array.from({ length: poolCount }, (_, i) => ({
    category_id: catId,
    letter: POOL_LETTERS[i],
    sort_order: i,
  }));
  const { data: poolRows, error: poolErr } = await admin
    .from("tournament_pools")
    .insert(poolInserts)
    .select();
  if (poolErr || !poolRows) {
    return NextResponse.json(
      { error: poolErr?.message ?? "Failed to create pools" },
      { status: 500 }
    );
  }
  const poolByLetter = new Map<string, string>(
    poolRows.map((p) => [p.letter as string, p.id as string])
  );

  // Snake seed and build schedule.
  const seeded = snakeSeed(teams, poolCount);

  // Persist team assignments. Overall seed = rank in the full sorted
  // list (1..N); pool_seed = position within the pool (1..M).
  const sortedAll = [...teams].sort(
    (a, b) => b.combined_rating - a.combined_rating
  );
  const overallSeedById = new Map(sortedAll.map((t, i) => [t.id, i + 1]));

  const teamUpdates: { id: string; pool_id: string; seed: number; pool_seed: number }[] = [];
  seeded.forEach((poolTeams, poolIdx) => {
    poolTeams.forEach((team, idxInPool) => {
      const poolId = poolByLetter.get(POOL_LETTERS[poolIdx]);
      if (!poolId) return;
      teamUpdates.push({
        id: team.id,
        pool_id: poolId,
        seed: overallSeedById.get(team.id) ?? 0,
        pool_seed: idxInPool + 1,
      });
    });
  });
  for (const u of teamUpdates) {
    const { error: upErr } = await admin
      .from("teams")
      .update({ pool_id: u.pool_id, seed: u.seed, pool_seed: u.pool_seed })
      .eq("id", u.id);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  // Build + insert pool-play games.
  const games = buildSchedule({
    pools: seeded.map((teams, i) => ({ letter: POOL_LETTERS[i], teams })),
    courts: courts.map((c) => ({ id: c.id })),
  });

  const gameInserts = games.map((g) => ({
    category_id: catId,
    pool_id: poolByLetter.get(g.pool_letter) ?? null,
    stage: "pool" as const,
    round: g.round,
    court_id: g.court_id,
    team_a_id: g.team_a_id,
    team_b_id: g.team_b_id,
    sort_order: g.sort_order,
  }));

  const { error: gameErr } = await admin.from("games").insert(gameInserts);
  if (gameErr) {
    return NextResponse.json({ error: gameErr.message }, { status: 500 });
  }

  return NextResponse.json({
    pools: poolRows.length,
    games: gameInserts.length,
    teams: teams.length,
  });
}

/**
 * DELETE — wipe all pools + games + team assignments for the category,
 * returning it to pre-generation state.
 */
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

  await admin.from("games").delete().eq("category_id", catId);
  await admin.from("tournament_pools").delete().eq("category_id", catId);
  await admin
    .from("teams")
    .update({ pool_id: null, seed: null, pool_seed: null })
    .eq("category_id", catId);

  return NextResponse.json({ ok: true });
}
