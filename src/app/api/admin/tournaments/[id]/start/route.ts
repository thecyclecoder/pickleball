import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { notifyTournamentStart } from "@/lib/notify-tournament-start";

/**
 * Tournament-start blast. Sends every active player their pool
 * schedule via WhatsApp (or email, if they don't have a phone on
 * file). Round-1 teams get an extra "you're up first" message.
 *
 * Pool play must already be generated for this to make sense — if
 * there are no pool games, the blast no-ops with attempted=0.
 *
 * Sandbox: only the workspace owner gets the message (a representative
 * sample of one real player's pool/schedule), so this is safe to test.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: tournament } = await admin
    .from("tournaments")
    .select("id, title, slug, workspace_id, sandbox_mode")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  const t = tournament as {
    id: string;
    title: string;
    slug: string;
    workspace_id: string;
    sandbox_mode: boolean;
  };

  const outcome = await notifyTournamentStart({
    admin,
    tournament: t,
  });
  return NextResponse.json(outcome);
}
