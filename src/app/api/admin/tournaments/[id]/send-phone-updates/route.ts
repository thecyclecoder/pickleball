import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrAdmin } from "@/lib/api";
import { buildPlayerUpdateToken } from "@/lib/player-update-token";
import { generateMagicLink, sendPhoneUpdateRequestEmail } from "@/lib/email";

/**
 * Send the "Add your WhatsApp number" email to every active player on
 * this tournament who hasn't filled in a phone yet. Idempotent in
 * effect (we don't track per-player reminders yet, so re-running just
 * re-sends to anyone still missing).
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerOrAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: tournament } = await admin
    .from("tournaments")
    .select("id, slug, title")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  type Row = {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
    team: { status: string; tournament_id: string } | null;
  };
  const { data: players } = await admin
    .from("players")
    .select(
      `id, first_name, last_name, email, phone,
       team:teams!inner(status, tournament_id)`
    )
    .eq("team.tournament_id", tournament.id)
    .neq("team.status", "cancelled");

  // Dedupe by email — a player can have multiple rows across teams
  const byEmail = new Map<string, Row>();
  for (const p of (players ?? []) as unknown as Row[]) {
    if (p.phone && p.phone.trim()) continue;
    const e = p.email.toLowerCase();
    if (!byEmail.has(e)) byEmail.set(e, p);
  }

  const recipients = Array.from(byEmail.values());
  let sent = 0;
  let failed = 0;
  for (const p of recipients) {
    try {
      const token = buildPlayerUpdateToken(p.id);
      const cta = await generateMagicLink(p.email, `/u/${token}`);
      await sendPhoneUpdateRequestEmail({
        toEmail: p.email,
        toFirstName: p.first_name,
        tournamentTitle: tournament.title,
        ctaLink: cta,
      });
      sent++;
      // Resend allows ~10/s — gentle pacing keeps us well under
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) {
      console.error("send-phone-update failed:", p.email, e);
      failed++;
    }
  }

  return NextResponse.json({ sent, failed, total: recipients.length });
}
