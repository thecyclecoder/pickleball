import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

/** PATCH /api/admin/players/<playerId>/paid { paid: boolean }
 *  Set paid_at = now() when paid=true, null when paid=false.
 *  Only callable by a workspace member on a player in that workspace. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ playerId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { playerId } = await params;

  const admin = createAdminClient();

  // Confirm the player belongs to the active workspace
  const { data: player } = await admin
    .from("players")
    .select("id, workspace_id")
    .eq("id", playerId)
    .limit(1)
    .single();
  if (!player || player.workspace_id !== auth.ctx.member.workspace_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.paid !== "boolean") {
    return NextResponse.json({ error: "paid boolean required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("players")
    .update({ paid_at: body.paid ? new Date().toISOString() : null })
    .eq("id", playerId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ player: data });
}
