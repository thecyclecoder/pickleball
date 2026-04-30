import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { notifyCheckIn } from "@/lib/notify-check-in";

/**
 * Check a player in for the tournament. Optional body { phone } —
 * when provided AND the player has no phone on file, the phone is
 * saved across all of this player's rows in the system (matched by
 * lower-cased email) so the next time they register they're
 * pre-populated.
 *
 * After flipping checked_in_at, fires the tournament_check_in
 * WhatsApp template with their pool / partner / first-match info.
 * Sandbox redirects the send to the workspace owner.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, playerId } = await params;
  const admin = createAdminClient();

  const { data: tournament } = await admin
    .from("tournaments")
    .select("id, title, workspace_id, sandbox_mode")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  const t = tournament as {
    id: string;
    title: string;
    workspace_id: string;
    sandbox_mode: boolean;
  };

  // Player + scope check (must belong to a team in this tournament)
  const { data: player } = await admin
    .from("players")
    .select(
      `id, email, phone, first_name, last_name, team_id, checked_in_at,
       team:teams!inner ( id, tournament_id )`
    )
    .eq("id", playerId)
    .maybeSingle();
  const playerRow = player as unknown as
    | {
        id: string;
        email: string;
        phone: string | null;
        first_name: string;
        last_name: string;
        team_id: string;
        checked_in_at: string | null;
        team: { id: string; tournament_id: string } | null;
      }
    | null;
  if (!playerRow || playerRow.team?.tournament_id !== id) {
    return NextResponse.json({ error: "Player not found in this tournament" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const incomingPhone =
    typeof body?.phone === "string" ? body.phone.trim() : "";
  let recipientPhone: string | null = playerRow.phone?.trim() || null;

  // If a phone was supplied AND the player doesn't already have one,
  // backfill it across every player row sharing this email so future
  // tournaments / clinics inherit it.
  if (incomingPhone && !recipientPhone) {
    await admin
      .from("players")
      .update({ phone: incomingPhone })
      .eq("email", playerRow.email)
      .is("phone", null);
    recipientPhone = incomingPhone;
  }

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await admin
    .from("players")
    .update({ checked_in_at: now })
    .eq("id", playerId)
    .select()
    .single();
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  let notify: Awaited<ReturnType<typeof notifyCheckIn>> | null = null;
  try {
    notify = await notifyCheckIn({
      admin,
      tournament: t,
      teamId: playerRow.team_id,
      recipientPhone,
    });
  } catch (e) {
    console.error("[check-in] notify failed:", e);
  }

  return NextResponse.json({ player: updated, notify });
}

/** DELETE — undo the check-in (clear the timestamp). Doesn't send any
 *  notification. */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; playerId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, playerId } = await params;
  const admin = createAdminClient();

  const { data: player } = await admin
    .from("players")
    .select(
      `id, team:teams!inner ( tournament_id, workspace_id )`
    )
    .eq("id", playerId)
    .maybeSingle();
  const row = player as unknown as
    | { id: string; team: { tournament_id: string; workspace_id: string } | null }
    | null;
  if (
    !row ||
    row.team?.tournament_id !== id ||
    row.team.workspace_id !== auth.ctx.member.workspace_id
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await admin
    .from("players")
    .update({ checked_in_at: null })
    .eq("id", playerId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
