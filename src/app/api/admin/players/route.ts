import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";

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

/**
 * PATCH — edit a player's details (first_name, last_name, phone, rating)
 * across every row that references the email. Super-admin only because
 * the change fans out across workspaces and across tables — clinic
 * registrations, lesson requests, lessons, and tournament players all
 * pick up the new name + phone. Rating only applies to the tournament
 * `players` table (clinic uses rating_self, lesson_requests uses
 * skill_level — different semantics, left alone).
 *
 * Email is intentionally not editable here yet: changing it would have
 * to migrate auth.users and re-link every related row, and the surface
 * area for breakage is much larger. Add later if needed.
 */
export async function PATCH(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const membership = await getCurrentMembership();
  if (membership.status !== "ok" || !isSuperAdmin(membership.user)) {
    return NextResponse.json({ error: "Super-admin only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const email = (searchParams.get("email") ?? "").trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "email query param required" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const firstName =
    typeof body.first_name === "string" ? body.first_name.trim() : null;
  const lastName =
    typeof body.last_name === "string" ? body.last_name.trim() : null;
  const phone =
    typeof body.phone === "string" ? body.phone.trim() || null : undefined;
  const rating =
    body.rating !== undefined && body.rating !== null && body.rating !== ""
      ? Number(body.rating)
      : undefined;

  if (firstName === "" || lastName === "") {
    return NextResponse.json(
      { error: "first_name and last_name cannot be empty" },
      { status: 400 }
    );
  }
  if (rating !== undefined && (!Number.isFinite(rating) || rating < 0 || rating > 9)) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Build a "name + phone" patch shared across tables, plus a rating
  // patch only for tournament players. Skip a key when the caller didn't
  // pass it (so omitted fields aren't accidentally cleared).
  const sharedPatch: Record<string, unknown> = {};
  if (firstName !== null) sharedPatch.first_name = firstName;
  if (lastName !== null) sharedPatch.last_name = lastName;
  if (phone !== undefined) sharedPatch.phone = phone;

  const lessonsPatch: Record<string, unknown> = {};
  if (firstName !== null) lessonsPatch.player_first_name = firstName;
  if (lastName !== null) lessonsPatch.player_last_name = lastName;
  if (phone !== undefined) lessonsPatch.player_phone = phone;

  const playersPatch: Record<string, unknown> = { ...sharedPatch };
  if (rating !== undefined) playersPatch.rating = rating;

  // Fan-out updates. Each table is independent — partial failure leaves
  // the system in a "mixed" state but doesn't corrupt any individual row.
  const updates = [
    Object.keys(playersPatch).length > 0
      ? admin.from("players").update(playersPatch).ilike("email", email)
      : Promise.resolve({ error: null }),
    Object.keys(sharedPatch).length > 0
      ? admin.from("clinic_registrations").update(sharedPatch).ilike("email", email)
      : Promise.resolve({ error: null }),
    Object.keys(sharedPatch).length > 0
      ? admin.from("lesson_requests").update(sharedPatch).ilike("email", email)
      : Promise.resolve({ error: null }),
    Object.keys(lessonsPatch).length > 0
      ? admin.from("lessons").update(lessonsPatch).ilike("player_email", email)
      : Promise.resolve({ error: null }),
  ];

  const results = await Promise.all(updates);
  const firstError = results.find(
    (r) => r && typeof r === "object" && "error" in r && r.error
  );
  if (firstError && "error" in firstError && firstError.error) {
    return NextResponse.json(
      { error: (firstError.error as { message?: string }).message ?? "Update failed" },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
