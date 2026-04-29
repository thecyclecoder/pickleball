import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { calculatePoolStandings } from "@/lib/standings";
import { categoryLabel } from "@/lib/categories";
import {
  renderPoolResultSvg,
  renderBracketSvg,
  renderTournamentResultSvg,
  compositeOverTemplate,
  type PoolResultTeam,
  type BracketMatchup,
} from "@/lib/graphic-render";
import type { Game, Player, Team, TournamentCategory } from "@/lib/types";

const VARIANT_TYPES = new Set([
  "pool_result",
  "bracket_qf",
  "bracket_sf",
  "bracket_f",
  "tournament_result",
]);

export const runtime = "nodejs";

type TeamRow = Team & { players: Player[] };

function teamLabel(t: TeamRow | undefined): string {
  if (!t) return "—";
  const sorted = [...t.players].sort(
    (a, b) => Number(b.is_captain) - Number(a.is_captain)
  );
  return sorted.map((p) => `${p.first_name} ${p.last_name}`).join(" & ") || "Team";
}

/**
 * Render and store a tournament graphic variant. The admin-uploaded
 * template is the backdrop (one per tournament); type + target_key
 * pick which data overlay goes on top.
 *
 * Body (optional): { target_key?: string }
 *   - pool_result: target_key = pool_id (required)
 *   - bracket_qf/sf/f, tournament_result: target_key = category_id
 *     (required)
 *
 * No AI. The renderers in lib/graphic-render.ts are deterministic —
 * same data in, same output every time.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, type } = await params;
  if (!VARIANT_TYPES.has(type)) {
    return NextResponse.json(
      { error: `Unknown graphic type: ${type}` },
      { status: 400 }
    );
  }
  const admin = createAdminClient();

  const { data: tournament } = await admin
    .from("tournaments")
    .select("id, title")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  // Template image is required.
  const { data: tplRow } = await admin
    .from("tournament_graphics")
    .select("png_url")
    .eq("tournament_id", id)
    .eq("type", "template")
    .maybeSingle();
  const templateUrl = (tplRow as { png_url: string | null } | null)?.png_url;
  if (!templateUrl) {
    return NextResponse.json(
      { error: "Upload a tournament template image before generating graphics" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const targetKey =
    typeof body?.target_key === "string" && body.target_key ? body.target_key : null;

  // Build the SVG overlay specific to this variant.
  let svg: string;
  if (type === "pool_result") {
    if (!targetKey) {
      return NextResponse.json(
        { error: "pool_result requires target_key (pool id)" },
        { status: 400 }
      );
    }
    const { data: pool } = await admin
      .from("tournament_pools")
      .select("id, letter, category_id")
      .eq("id", targetKey)
      .maybeSingle();
    const poolRow = pool as
      | { id: string; letter: string; category_id: string }
      | null;
    if (!poolRow) {
      return NextResponse.json({ error: "Pool not found" }, { status: 404 });
    }

    const { data: cat } = await admin
      .from("tournament_categories")
      .select("advance_per_pool, format:tournament_formats (pool_play_advance_per_pool)")
      .eq("id", poolRow.category_id)
      .maybeSingle();
    const catRow = cat as unknown as
      | {
          advance_per_pool: number | null;
          format: { pool_play_advance_per_pool: number } | null;
        }
      | null;
    const advance =
      catRow?.advance_per_pool ?? catRow?.format?.pool_play_advance_per_pool ?? 2;

    const { data: poolTeams } = await admin
      .from("teams")
      .select("id, players (first_name, last_name, email, phone, is_captain, rating)")
      .eq("pool_id", poolRow.id);
    const teams = (poolTeams ?? []) as unknown as TeamRow[];

    const { data: poolGames } = await admin
      .from("games")
      .select("*")
      .eq("pool_id", poolRow.id)
      .eq("stage", "pool");
    const games = (poolGames ?? []) as Game[];

    const standings = calculatePoolStandings(
      teams.map((t) => t.id),
      games
    );
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const renderTeams: PoolResultTeam[] = standings.map((s) => ({
      place: s.place,
      label: teamLabel(teamById.get(s.team_id)),
      wins: s.wins,
      losses: s.losses,
      diff: s.diff,
      advancing: s.place <= advance,
    }));
    svg = renderPoolResultSvg({ poolLetter: poolRow.letter, teams: renderTeams });
  } else if (type === "bracket_qf" || type === "bracket_sf" || type === "bracket_f") {
    if (!targetKey) {
      return NextResponse.json(
        { error: `${type} requires target_key (category id)` },
        { status: 400 }
      );
    }
    const stageMap = {
      bracket_qf: { stage: "qf" as const, label: "Quarterfinals" },
      bracket_sf: { stage: "sf" as const, label: "Semifinals" },
      bracket_f: { stage: "f" as const, label: "Final" },
    };
    const { stage, label } = stageMap[type];

    const { data: stageGames } = await admin
      .from("games")
      .select("*")
      .eq("category_id", targetKey)
      .eq("stage", stage)
      .order("sort_order", { ascending: true });
    const games = (stageGames ?? []) as Game[];
    if (games.length === 0) {
      return NextResponse.json(
        { error: `No ${stage} games yet — seed the bracket first` },
        { status: 400 }
      );
    }

    const teamIds = Array.from(
      new Set(
        games.flatMap((g) => [g.team_a_id, g.team_b_id].filter((v): v is string => !!v))
      )
    );
    const { data: teams } = teamIds.length
      ? await admin
          .from("teams")
          .select("id, players (first_name, last_name, email, phone, is_captain, rating)")
          .in("id", teamIds)
      : { data: [] };
    const teamRows = (teams ?? []) as unknown as TeamRow[];
    const teamById = new Map(teamRows.map((t) => [t.id, t]));

    const matchups: BracketMatchup[] = games.map((g) => {
      const a = g.team_a_id ? teamById.get(g.team_a_id) : undefined;
      const b = g.team_b_id ? teamById.get(g.team_b_id) : undefined;
      const aLabel = a ? teamLabel(a) : "TBD";
      const bLabel = b ? teamLabel(b) : "TBD";
      const hasScore = g.score_a != null && g.score_b != null;
      return {
        teamALabel: aLabel,
        teamBLabel: bLabel,
        scoreA: g.score_a,
        scoreB: g.score_b,
        hasScore,
      };
    });
    svg = renderBracketSvg({ stageLabel: label, matchups });
  } else {
    // tournament_result
    if (!targetKey) {
      return NextResponse.json(
        { error: "tournament_result requires target_key (category id)" },
        { status: 400 }
      );
    }
    const { data: cat } = await admin
      .from("tournament_categories")
      .select("id, type, rating, label, label_es, sort_order, tournament_id, format_id, pool_count, advance_per_pool, semifinals_court_id, finals_court_id, team_limit, waitlist_limit, created_at")
      .eq("id", targetKey)
      .maybeSingle();
    const catRow = cat as TournamentCategory | null;
    if (!catRow) {
      return NextResponse.json({ error: "Category not found" }, { status: 404 });
    }

    const { data: stageGames } = await admin
      .from("games")
      .select("*")
      .eq("category_id", targetKey)
      .in("stage", ["sf", "f"]);
    const games = (stageGames ?? []) as Game[];
    const finalGame = games.find((g) => g.stage === "f" && g.score_a != null && g.score_b != null);
    if (!finalGame || !finalGame.winner_team_id) {
      return NextResponse.json(
        { error: "Final hasn't been scored yet" },
        { status: 400 }
      );
    }

    const teamIds = Array.from(
      new Set(
        games.flatMap((g) => [g.team_a_id, g.team_b_id, g.winner_team_id].filter((v): v is string => !!v))
      )
    );
    const { data: teams } = teamIds.length
      ? await admin
          .from("teams")
          .select("id, players (first_name, last_name, email, phone, is_captain, rating)")
          .in("id", teamIds)
      : { data: [] };
    const teamRows = (teams ?? []) as unknown as TeamRow[];
    const teamById = new Map(teamRows.map((t) => [t.id, t]));

    const champion = teamById.get(finalGame.winner_team_id);
    const runnerUpId =
      finalGame.team_a_id === finalGame.winner_team_id
        ? finalGame.team_b_id
        : finalGame.team_a_id;
    const runnerUp = runnerUpId ? teamById.get(runnerUpId) : null;
    const sfLoserIds = games
      .filter(
        (g) =>
          g.stage === "sf" && g.score_a != null && g.score_b != null && g.winner_team_id
      )
      .map((g) => (g.winner_team_id === g.team_a_id ? g.team_b_id : g.team_a_id))
      .filter((id): id is string => !!id);
    const sfLabels = sfLoserIds
      .map((id) => teamById.get(id))
      .filter((t): t is TeamRow => !!t)
      .map((t) => teamLabel(t));

    svg = renderTournamentResultSvg({
      championLabel: teamLabel(champion),
      runnerUpLabel: runnerUp ? teamLabel(runnerUp) : null,
      semifinalistLabels: sfLabels,
      categoryDisplay: categoryLabel(catRow),
    });
  }

  // Composite + upload
  let png: Buffer;
  try {
    png = await compositeOverTemplate({ templateUrl, overlaySvg: svg });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Compositing failed" },
      { status: 500 }
    );
  }

  const ts = Date.now();
  const pngPath = `graphics/${id}/${type}/${targetKey ?? "all"}_${ts}.png`;
  const { error: upErr } = await admin.storage
    .from("tournament-images")
    .upload(pngPath, png, { contentType: "image/png", upsert: false });
  if (upErr) {
    return NextResponse.json({ error: `upload: ${upErr.message}` }, { status: 500 });
  }
  const { data: urlData } = admin.storage
    .from("tournament-images")
    .getPublicUrl(pngPath);

  // Replace any existing row for (tournament, type, target_key).
  await admin
    .from("tournament_graphics")
    .delete()
    .eq("tournament_id", id)
    .eq("type", type)
    .eq("target_key", targetKey);
  if (targetKey === null) {
    // For null target_key the .eq above on null doesn't match — clean
    // with .is() instead.
    await admin
      .from("tournament_graphics")
      .delete()
      .eq("tournament_id", id)
      .eq("type", type)
      .is("target_key", null);
  }

  const { data: row, error: rowErr } = await admin
    .from("tournament_graphics")
    .insert({
      tournament_id: id,
      type,
      target_key: targetKey,
      svg,
      png_url: urlData.publicUrl,
      approved: false,
    })
    .select()
    .single();
  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }

  return NextResponse.json({ graphic: row });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, type } = await params;
  const admin = createAdminClient();
  const body = await req.json().catch(() => ({}));
  if (typeof body?.approved !== "boolean") {
    return NextResponse.json({ error: "approved must be a boolean" }, { status: 400 });
  }
  const targetKey =
    typeof body?.target_key === "string" && body.target_key ? body.target_key : null;
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let q = admin
    .from("tournament_graphics")
    .update({ approved: body.approved })
    .eq("tournament_id", id)
    .eq("type", type);
  q = targetKey ? q.eq("target_key", targetKey) : q.is("target_key", null);

  const { data, error } = await q.select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ graphic: data });
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, type } = await params;
  const admin = createAdminClient();
  const { searchParams } = new URL(req.url);
  const targetKey = searchParams.get("target_key");
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  let q = admin
    .from("tournament_graphics")
    .delete()
    .eq("tournament_id", id)
    .eq("type", type);
  q = targetKey ? q.eq("target_key", targetKey) : q.is("target_key", null);
  await q;
  return NextResponse.json({ ok: true });
}
