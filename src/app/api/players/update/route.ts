import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePlayerUpdateToken } from "@/lib/player-update-token";

/**
 * Player self-service phone update via signed token from an email link.
 *
 * Validates the token, loads the player by ID, and writes the new phone
 * across every table that references the player's email — same fan-out
 * as the super-admin player edit, so a single update keeps tournament,
 * clinic, lesson-request, and lessons rows consistent.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const token = (body.token ?? "").toString();
  const phone = (body.phone ?? "").toString().trim();

  const parsed = parsePlayerUpdateToken(token);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid or expired link" }, { status: 403 });
  }
  if (!phone) {
    return NextResponse.json({ error: "Phone is required" }, { status: 400 });
  }
  // Loose phone validation — we accept anything with a few digits and
  // let the wa.me normalizer handle formatting at send time.
  if ((phone.match(/\d/g) ?? []).length < 7) {
    return NextResponse.json({ error: "Enter a valid phone number" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: player } = await admin
    .from("players")
    .select("id, email")
    .eq("id", parsed.playerId)
    .maybeSingle();
  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  const email = (player.email ?? "").toLowerCase();

  // Fan out across all tables that store this email's phone.
  const ops = [
    admin.from("players").update({ phone }).ilike("email", email),
    admin.from("clinic_registrations").update({ phone }).ilike("email", email),
    admin.from("lesson_requests").update({ phone }).ilike("email", email),
    admin.from("lessons").update({ player_phone: phone }).ilike("player_email", email),
  ];
  const results = await Promise.all(ops);
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
