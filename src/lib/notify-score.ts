/**
 * Score-update notifications: fire WhatsApp `match_score_update` to the
 * players involved in a match. Sandbox-aware: when the tournament has
 * sandbox_mode=true, recipients are redirected to workspace owners +
 * admins (whose phones are looked up from any player record matching
 * their email) and the tournament name is prefixed with [SANDBOX] so
 * the recipient can see at a glance the message is a dry run.
 *
 * The hook is fire-and-await but never throws — score saves shouldn't
 * fail because WhatsApp is down. Outcomes are returned to the caller
 * for logging.
 *
 * Template body (already approved):
 *   The score for your match has been recorded for {{1}}. Your team
 *   {{2}} played against {{3}}. Final result: {{4}} to {{5}}. View the
 *   updated standings on Buen Tiro.
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

const TEMPLATE_NAME = "match_score_update";

function teamLabel(players: MinimalPlayer[]): string {
  if (players.length === 0) return "Team";
  return players
    .map((p) => `${p.first_name} ${p.last_name.slice(0, 1)}.`)
    .join(" / ");
}

export async function notifyMatchScore(args: Args): Promise<ScoreNotifyOutcome> {
  const { admin, tournament, teamA, teamB, scoreA, scoreB } = args;
  const aLabel = teamLabel(teamA.players);
  const bLabel = teamLabel(teamB.players);

  // Build the recipient list. Each entry carries the params from the
  // perspective of the recipient (team-A players see their team first
  // in the body, team-B players see theirs first).
  type Recipient = { phone: string; params: string[] };
  const recipients: Recipient[] = [];

  const titleForBody = tournament.sandbox_mode
    ? `[SANDBOX] ${tournament.title}`
    : tournament.title;

  if (tournament.sandbox_mode) {
    // Redirect to workspace owners + admins. Pull their phones from
    // any player record matching their member email (lower-cased).
    const { data: members } = await admin
      .from("workspace_members")
      .select("email, role")
      .eq("workspace_id", tournament.workspace_id)
      .in("role", ["owner", "admin"]);
    const memberEmails = (members ?? [])
      .map((m) => (m.email as string).toLowerCase())
      .filter(Boolean);

    if (memberEmails.length === 0) {
      return { attempted: 0, delivered: 0, failures: [], sandbox: true };
    }

    const { data: matchedPlayers } = await admin
      .from("players")
      .select("email, phone")
      .in("email", memberEmails)
      .not("phone", "is", null);

    const seen = new Set<string>();
    for (const row of matchedPlayers ?? []) {
      const phone = (row.phone as string | null)?.trim();
      if (!phone) continue;
      if (seen.has(phone)) continue;
      seen.add(phone);
      // Sandbox messages always go from team-A perspective — admins
      // aren't on either team, so the per-side personalization is moot.
      recipients.push({
        phone,
        params: [titleForBody, aLabel, bLabel, String(scoreA), String(scoreB)],
      });
    }
  } else {
    const seen = new Set<string>();
    const push = (
      players: MinimalPlayer[],
      myLabel: string,
      theirLabel: string,
      myScore: number,
      theirScore: number
    ) => {
      for (const p of players) {
        const phone = p.phone?.trim();
        if (!phone) continue;
        if (seen.has(phone)) continue;
        seen.add(phone);
        recipients.push({
          phone,
          params: [
            titleForBody,
            myLabel,
            theirLabel,
            String(myScore),
            String(theirScore),
          ],
        });
      }
    };
    push(teamA.players, aLabel, bLabel, scoreA, scoreB);
    push(teamB.players, bLabel, aLabel, scoreB, scoreA);
  }

  if (recipients.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      failures: [],
      sandbox: tournament.sandbox_mode,
    };
  }

  const results = await Promise.all(
    recipients.map(async (r) => {
      const result = await sendTemplate({
        to: r.phone,
        template: TEMPLATE_NAME,
        bodyParams: r.params,
      });
      return { phone: r.phone, result };
    })
  );

  const failures = results
    .filter((r) => !r.result.ok)
    .map((r) => ({
      phone: r.phone,
      error: (r.result as { ok: false; error: string }).error,
    }));

  return {
    attempted: recipients.length,
    delivered: recipients.length - failures.length,
    failures,
    sandbox: tournament.sandbox_mode,
  };
}
