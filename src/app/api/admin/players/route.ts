import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

/** Delete a player (by email) from the active workspace.
 *  Removes:
 *  - All teams in this workspace where the email appears as a player
 *  - All player rows for this email in this workspace
 *
 *  Partner players whose team gets deleted become "detached" (team_id=null)
 *  rather than being deleted — they still exist in the players table as a
 *  historical record, consistent with the "players live forever" policy.
 *
 *  Does NOT touch the auth user. If the person has signed up, their auth
 *  account persists and they can still sign in. To fully remove an auth
 *  user, use the Supabase dashboard. */
export async function DELETE(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Which teams in this workspace include this email?
  const { data: playerRows, error: findErr } = await admin
    .from("players")
    .select("team_id")
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .ilike("email", email);
  if (findErr) return NextResponse.json({ error: findErr.message }, { status: 500 });

  const teamIds = Array.from(
    new Set((playerRows ?? []).map((p) => p.team_id).filter(Boolean) as string[])
  );

  if (teamIds.length > 0) {
    const { error: teamErr } = await admin.from("teams").delete().in("id", teamIds);
    if (teamErr) return NextResponse.json({ error: teamErr.message }, { status: 500 });
  }

  const { error: delErr } = await admin
    .from("players")
    .delete()
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .ilike("email", email);
  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, teams_deleted: teamIds.length });
}
