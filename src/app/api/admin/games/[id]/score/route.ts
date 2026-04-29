import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { rulesForStage, validateGameScore } from "@/lib/score-validate";
import { notifyMatchScore } from "@/lib/notify-score";
import { nextBracketSlot } from "@/lib/bracket-seed";
import type { GameStage } from "@/lib/types";

type GameRow = {
  id: string;
  category_id: string;
  pool_id: string | null;
  stage: GameStage;
  sort_order: number;
  team_a_id: string | null;
  team_b_id: string | null;
  score_a: number | null;
  score_b: number | null;
  status: string;
  category: {
    id: string;
    tournament_id: string;
    format_id: string | null;
    tournament: {
      id: string;
      title: string;
      workspace_id: string;
      sandbox_mode: boolean;
    } | null;
    format: Parameters<typeof rulesForStage>[0] | null;
  } | null;
};

async function loadGame(
  admin: ReturnType<typeof createAdminClient>,
  gameId: string,
  workspaceId: string
): Promise<{ ok: true; game: GameRow } | { ok: false; status: number; error: string }> {
  const { data, error } = await admin
    .from("games")
    .select(
      `id, category_id, pool_id, stage, sort_order, team_a_id, team_b_id, score_a, score_b, status,
       category:tournament_categories!inner (
         id, tournament_id, format_id,
         tournament:tournaments!inner ( id, title, workspace_id, sandbox_mode ),
         format:tournament_formats ( * )
       )`
    )
    .eq("id", gameId)
    .maybeSingle();
  if (error || !data) {
    return { ok: false, status: 404, error: "Game not found" };
  }
  const g = data as unknown as GameRow;
  if (!g.category?.tournament || g.category.tournament.workspace_id !== workspaceId) {
    return { ok: false, status: 404, error: "Game not found" };
  }
  return { ok: true, game: g };
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const loaded = await loadGame(admin, id, auth.ctx.member.workspace_id);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const game = loaded.game;

  if (!game.team_a_id || !game.team_b_id) {
    return NextResponse.json(
      { error: "Both teams must be set on this game before a score can be recorded" },
      { status: 400 }
    );
  }
  if (!game.category?.format) {
    return NextResponse.json(
      { error: "This category has no tournament format set — pick one before entering scores" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const scoreARaw = body.score_a;
  const scoreBRaw = body.score_b;
  const forfeit = Boolean(body.forfeit);

  if (typeof scoreARaw !== "number" || typeof scoreBRaw !== "number") {
    return NextResponse.json({ error: "score_a and score_b are required numbers" }, { status: 400 });
  }

  const rules = rulesForStage(game.category.format, game.stage);
  if (!rules) {
    return NextResponse.json(
      { error: `Format has no rules configured for stage "${game.stage}"` },
      { status: 400 }
    );
  }

  const result = validateGameScore(rules, scoreARaw, scoreBRaw, { forfeit });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  const winnerId = scoreARaw > scoreBRaw ? game.team_a_id : game.team_b_id;

  const { data: updated, error: upErr } = await admin
    .from("games")
    .update({
      score_a: scoreARaw,
      score_b: scoreBRaw,
      winner_team_id: winnerId,
      status: "completed",
    })
    .eq("id", id)
    .select()
    .single();
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Bracket auto-advance: if this was a QF or SF, write the winner
  // into the next-stage game's appropriate slot. The lineage mapping
  // is deterministic (QF[i] → SF[floor(i/2)].team_(a|b);
  // SF[i] → F.team_(a|b)). Errors here just log — they don't fail
  // the score save.
  if ((game.stage === "qf" || game.stage === "sf") && game.category) {
    try {
      const slot = nextBracketSlot(game.stage, game.sort_order);
      const { error: advErr } = await admin
        .from("games")
        .update({
          [slot.intoSlot === "a" ? "team_a_id" : "team_b_id"]: winnerId,
        })
        .eq("category_id", game.category.id)
        .eq("stage", slot.nextStage)
        .eq("sort_order", slot.nextSortOrder);
      if (advErr) console.error("[score] bracket advance failed:", advErr);
    } catch (e) {
      console.error("[score] bracket advance threw:", e);
    }
  }

  // Fire WhatsApp `match_score_update` notifications. Wrapped in
  // try/catch so a delivery problem can't fail the score save —
  // the recorded result is the source of truth.
  let notify: Awaited<ReturnType<typeof notifyMatchScore>> | null = null;
  try {
    const tournament = game.category?.tournament;
    if (tournament && game.team_a_id && game.team_b_id) {
      const { data: teams } = await admin
        .from("teams")
        .select("id, players ( first_name, last_name, email, phone )")
        .in("id", [game.team_a_id, game.team_b_id]);
      const teamRows = (teams ?? []) as unknown as {
        id: string;
        players: { first_name: string; last_name: string; email: string; phone: string | null }[];
      }[];
      const teamA = teamRows.find((t) => t.id === game.team_a_id);
      const teamB = teamRows.find((t) => t.id === game.team_b_id);
      if (teamA && teamB) {
        notify = await notifyMatchScore({
          admin,
          tournament: {
            id: tournament.id,
            title: tournament.title,
            workspace_id: tournament.workspace_id,
            sandbox_mode: tournament.sandbox_mode,
          },
          teamA: { id: teamA.id, players: teamA.players ?? [] },
          teamB: { id: teamB.id, players: teamB.players ?? [] },
          scoreA: scoreARaw,
          scoreB: scoreBRaw,
        });
      }
    }
  } catch (e) {
    console.error("[score] notify failed:", e);
  }

  return NextResponse.json({ game: updated, notify });
}

/**
 * Clear a recorded score (set the game back to "scheduled, no result").
 * Stage-progression gate: a pool-stage score can only be cleared if no
 * later-stage game in the same category already has a result. Same rule
 * up the chain (qf → sf → f). Edits via POST are always allowed; this
 * gate is just for *deletes*, where wiping the score and leaving a later
 * round in place would corrupt the bracket lineage.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const loaded = await loadGame(admin, id, auth.ctx.member.workspace_id);
  if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: loaded.status });
  const game = loaded.game;

  if (game.score_a == null && game.score_b == null) {
    return NextResponse.json({ ok: true, noop: true });
  }

  const stageOrder: GameStage[] = ["pool", "qf", "sf", "f"];
  const currentIdx = stageOrder.indexOf(game.stage);
  const laterStages = stageOrder.slice(currentIdx + 1);

  if (laterStages.length > 0 && game.category) {
    const { data: later } = await admin
      .from("games")
      .select("id, stage")
      .eq("category_id", game.category.id)
      .in("stage", laterStages)
      .not("score_a", "is", null);
    if (later && later.length > 0) {
      return NextResponse.json(
        {
          error:
            "This score can't be cleared — a later round already has a recorded result. " +
            "Edit the score instead, or reset the entire tournament from the Danger Zone.",
        },
        { status: 409 }
      );
    }
  }

  const { error: upErr } = await admin
    .from("games")
    .update({
      score_a: null,
      score_b: null,
      winner_team_id: null,
      status: "scheduled",
    })
    .eq("id", id);
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  // Clearing a bracket score also unwinds the next-stage slot it fed.
  // The progression gate above already blocks the clear if the next
  // stage has a score, so we're safe to null its team slot here.
  if ((game.stage === "qf" || game.stage === "sf") && game.category) {
    try {
      const slot = nextBracketSlot(game.stage, game.sort_order);
      await admin
        .from("games")
        .update({
          [slot.intoSlot === "a" ? "team_a_id" : "team_b_id"]: null,
        })
        .eq("category_id", game.category.id)
        .eq("stage", slot.nextStage)
        .eq("sort_order", slot.nextSortOrder);
    } catch (e) {
      console.error("[score] bracket unwind failed:", e);
    }
  }

  return NextResponse.json({ ok: true });
}
