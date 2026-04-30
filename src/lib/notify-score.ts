/**
 * Score-update notifications: fire WhatsApp `match_score_update` to the
 * players involved in a match. Sandbox-aware: when the tournament has
 * sandbox_mode=true, recipients are redirected to the workspace owner
 * only (phone looked up via any player record matching the owner email)
 * and the tournament name is prefixed with [SANDBOX].
 *
 * Failures don't throw — score saves shouldn't fail because WhatsApp
 * is down. Outcomes returned for logging.
 *
 * Bilingual neutral framing — same content for both teams' players (no
 * per-recipient "your team" personalization), Spanish first then
 * English. Template params:
 *   {{1}} tournament title
 *   {{2}} team A label
 *   {{3}} team A score
 *   {{4}} team B score
 *   {{5}} team B label
 *
 * Suggested template body (submit at Meta):
 *   ✅ Resultado registrado para {{1}}: {{2}} {{3}} - {{4}} {{5}}.
 *   Mira la tabla actualizada en Buen Tiro.
 *
 *   ✅ Score recorded for {{1}}: {{2}} {{3}} - {{4}} {{5}}.
 *   View the updated standings on Buen Tiro.
 */

import { sendTemplate } from "./whatsapp";
import type { createAdminClient } from "./supabase/admin";

type MinimalPlayer = {
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

type Args = {
  admin: ReturnType<typeof createAdminClient>;
  tournament: { id: string; title: string; workspace_id: string; sandbox_mode: boolean };
  teamA: { id: string; players: MinimalPlayer[] };
  teamB: { id: string; players: MinimalPlayer[] };
  scoreA: number;
  scoreB: number;
};

export type ScoreNotifyOutcome = {
  attempted: number;
  delivered: number;
  failures: { phone: string; error: string }[];
  sandbox: boolean;
};

const TEMPLATE_NAME = "match_score_recorded";

function teamLabel(players: MinimalPlayer[]): string {
  if (players.length === 0) return "Team";
  return players.map((p) => `${p.first_name} ${p.last_name}`).join(" & ");
}

export async function notifyMatchScore(args: Args): Promise<ScoreNotifyOutcome> {
  const { admin, tournament, teamA, teamB, scoreA, scoreB } = args;
  const aLabel = teamLabel(teamA.players);
  const bLabel = teamLabel(teamB.players);

  const titleForBody = tournament.sandbox_mode
    ? `[SANDBOX] ${tournament.title}`
    : tournament.title;
  const params = [titleForBody, aLabel, String(scoreA), String(scoreB), bLabel];

  // Recipient list: neutral message goes to every player phone in both
  // teams (live) or just the workspace owner (sandbox). Same content for
  // everyone — no per-team personalization.
  const phones: string[] = [];
  const seen = new Set<string>();

  if (tournament.sandbox_mode) {
    const { data: members } = await admin
      .from("workspace_members")
      .select("email")
      .eq("workspace_id", tournament.workspace_id)
      .eq("role", "owner");
    const memberEmails = (members ?? [])
      .map((m) => (m.email as string).toLowerCase())
      .filter(Boolean);
    if (memberEmails.length === 0) {
      return { attempted: 0, delivered: 0, failures: [], sandbox: true };
    }
    const { data: matchedPlayers } = await admin
      .from("players")
      .select("phone")
      .in("email", memberEmails)
      .not("phone", "is", null);
    for (const row of matchedPlayers ?? []) {
      const phone = (row.phone as string | null)?.trim();
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      phones.push(phone);
    }
  } else {
    for (const p of [...teamA.players, ...teamB.players]) {
      const phone = p.phone?.trim();
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      phones.push(phone);
    }
  }

  if (phones.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      failures: [],
      sandbox: tournament.sandbox_mode,
    };
  }

  const results = await Promise.all(
    phones.map(async (phone) => {
      const result = await sendTemplate({
        to: phone,
        template: TEMPLATE_NAME,
        bodyParams: params,
      });
      return { phone, result };
    })
  );

  const failures = results
    .filter((r) => !r.result.ok)
    .map((r) => ({
      phone: r.phone,
      error: (r.result as { ok: false; error: string }).error,
    }));

  return {
    attempted: phones.length,
    delivered: phones.length - failures.length,
    failures,
    sandbox: tournament.sandbox_mode,
  };
}
