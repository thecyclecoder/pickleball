import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwner } from "@/lib/api";

/**
 * Reset all scoring for the tournament back to "no results recorded".
 *
 *   • Clears score_a / score_b / winner_team_id on every game in every
 *     category of the tournament, and resets each game's status to
 *     'scheduled'.
 *   • Pool memberships, seeds, schedule, courts — all UNTOUCHED. The
 *     reset is scores-only; if you want to re-seed pools you do that
 *     separately via the per-category Regenerate button.
 *
 * Owner-role only — admins and members get 403. This is destructive
 * across the whole tournament so it stays at the highest privilege.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;
  const { id } = await params;
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

  // Find every category in the tournament so we can scope the games update.
  const { data: cats } = await admin
    .from("tournament_categories")
    .select("id")
    .eq("tournament_id", id);
  const categoryIds = (cats ?? []).map((c) => c.id as string);
  if (categoryIds.length === 0) {
    return NextResponse.json({ ok: true, cleared: 0 });
  }

  const { error, count } = await admin
    .from("games")
    .update(
      {
        score_a: null,
        score_b: null,
        winner_team_id: null,
        status: "scheduled",
      },
      { count: "exact" }
    )
    .in("category_id", categoryIds)
    .or("score_a.not.is.null,score_b.not.is.null,winner_team_id.not.is.null,status.neq.scheduled");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cleared: count ?? 0 });
}
