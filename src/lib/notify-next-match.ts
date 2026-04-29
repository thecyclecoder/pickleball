/**
 * After a pool-stage game is scored, find the NEXT scheduled game on
 * the same court (in the same category) and ping its players via
 * WhatsApp telling them they're up. Helps keep the day moving — once
 * the previous match wraps, the next pair already knows to head over.
 *
 * Scope: pool stage only. Bracket games (qf/sf/f) get their own
 * standalone announcements once we wire those up. The "next" game is
 * the lowest (round, sort_order) tuple among same-court, same-category
 * pool games that don't have a recorded score yet.
 *
 * Sandbox-aware: redirects sends to workspace owner only (same rule
 * as the score-update notifier).
 *
 * Template: `match_starting` (2 params). Suggested bilingual body
 * (submit at Meta):
 *   🎾 Es tu turno en {{1}}. Tienes 5 minutos para calentar y luego
 *   comienza tu partido.
 *   {{2}}
 *
 *   🎾 You're up on {{1}}. You have 5 minutes to warm up, then start
 *   your game.
 *   {{2}}
 *
 * Where:
 *   {{1}} court label, e.g. "Court 1"
 *   {{2}} matchup with current records, e.g.
 *         "Dylan Ralston & Jack Munro (2-0) vs Eddie Declet & Pedro Maldonado (1-1)"
 */

import { sendTemplate } from "./whatsapp";
import { calculatePoolStandings } from "./standings";
import type { createAdminClient } from "./supabase/admin";
import type { Game, Player } from "./types";

const TEMPLATE_NAME = "match_starting";

type MinimalPlayer = Pick<Player, "first_name" | "last_name" | "email" | "phone">;

type Args = {
  admin: ReturnType<typeof createAdminClient>;
  tournament: { id: string; title: string; workspace_id: string; sandbox_mode: boolean };
  /** The game whose score was just saved. Used to scope the next-game
   *  lookup to its category + court, and to skip itself. */
  finishedGame: Pick<Game, "id" | "category_id" | "court_id" | "stage">;
};

export type NextMatchOutcome = {
  attempted: number;
  delivered: number;
  failures: { phone: string; error: string }[];
  sandbox: boolean;
  /** Reason no notifications fired, or null if some were attempted. */
  noopReason?:
    | "not_pool_stage"
    | "no_court"
    | "no_next_game"
    | "next_game_unassigned"
    | "no_phones";
};

function teamLabel(players: MinimalPlayer[]): string {
  if (players.length === 0) return "Team";
  return players.map((p) => `${p.first_name} ${p.last_name}`).join(" & ");
}

export async function notifyNextMatchOnCourt(args: Args): Promise<NextMatchOutcome> {
  const { admin, tournament, finishedGame } = args;
  const sandbox = tournament.sandbox_mode;
  if (finishedGame.stage !== "pool") {
    return { attempted: 0, delivered: 0, failures: [], sandbox, noopReason: "not_pool_stage" };
  }
  if (!finishedGame.court_id) {
    return { attempted: 0, delivered: 0, failures: [], sandbox, noopReason: "no_court" };
  }

  // Find the next pool game on the same court that hasn't been scored
  // yet. Order by round, then sort_order — the same ordering buildSchedule
  // uses, so "next" matches the visual schedule.
  const { data: candidates } = await admin
    .from("games")
    .select("id, round, sort_order, court_id, team_a_id, team_b_id, pool_id")
    .eq("category_id", finishedGame.category_id)
    .eq("court_id", finishedGame.court_id)
    .eq("stage", "pool")
    .neq("id", finishedGame.id)
    .is("score_a", null)
    .order("round", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(1);

  const next = (candidates ?? [])[0] as
    | {
        id: string;
        round: number;
        sort_order: number;
        court_id: string;
        team_a_id: string | null;
        team_b_id: string | null;
        pool_id: string | null;
      }
    | undefined;
  if (!next) {
    return { attempted: 0, delivered: 0, failures: [], sandbox, noopReason: "no_next_game" };
  }
  if (!next.team_a_id || !next.team_b_id) {
    return {
      attempted: 0,
      delivered: 0,
      failures: [],
      sandbox,
      noopReason: "next_game_unassigned",
    };
  }

  // Court label
  const { data: court } = await admin
    .from("tournament_courts")
    .select("number")
    .eq("id", next.court_id)
    .maybeSingle();
  const courtLabel = court ? `Court ${court.number}` : "Court";

  // Team rosters
  const { data: teams } = await admin
    .from("teams")
    .select("id, players ( first_name, last_name, email, phone )")
    .in("id", [next.team_a_id, next.team_b_id]);
  const teamRows = (teams ?? []) as unknown as {
    id: string;
    players: MinimalPlayer[];
  }[];
  const teamA = teamRows.find((t) => t.id === next.team_a_id);
  const teamB = teamRows.find((t) => t.id === next.team_b_id);
  if (!teamA || !teamB) {
    return { attempted: 0, delivered: 0, failures: [], sandbox, noopReason: "next_game_unassigned" };
  }
  const aLabel = teamLabel(teamA.players);
  const bLabel = teamLabel(teamB.players);

  // Each team's CURRENT pool record at the moment of this notification.
  // We pull the full pool of teams + games and run the standings calc
  // against just the next game's pool, so the W-L is scoped correctly
  // (a team in pool A only counts games inside pool A).
  let aRecord = "";
  let bRecord = "";
  if (next.pool_id) {
    const { data: poolTeams } = await admin
      .from("teams")
      .select("id")
      .eq("pool_id", next.pool_id);
    const { data: poolGames } = await admin
      .from("games")
      .select("*")
      .eq("pool_id", next.pool_id)
      .eq("stage", "pool");
    const teamIds = (poolTeams ?? []).map((t) => t.id as string);
    const standings = calculatePoolStandings(teamIds, (poolGames ?? []) as Game[]);
    const aRow = standings.find((s) => s.team_id === next.team_a_id);
    const bRow = standings.find((s) => s.team_id === next.team_b_id);
    if (aRow) aRecord = ` (${aRow.wins}-${aRow.losses})`;
    if (bRow) bRecord = ` (${bRow.wins}-${bRow.losses})`;
  }

  const matchupLine = `${aLabel}${aRecord} vs ${bLabel}${bRecord}`;
  const courtForBody = sandbox ? `[SANDBOX] ${courtLabel}` : courtLabel;

  // Recipient list (same sandbox redirect rule as score-update sends).
  // The message is neutral — same content goes to both teams' players,
  // so we collect phones only.
  const phones: string[] = [];
  const seenPhones = new Set<string>();

  if (sandbox) {
    const { data: ownerMembers } = await admin
      .from("workspace_members")
      .select("email")
      .eq("workspace_id", tournament.workspace_id)
      .eq("role", "owner");
    const ownerEmails = (ownerMembers ?? [])
      .map((m) => (m.email as string).toLowerCase())
      .filter(Boolean);
    if (ownerEmails.length === 0) {
      return { attempted: 0, delivered: 0, failures: [], sandbox, noopReason: "no_phones" };
    }
    const { data: ownerPlayers } = await admin
      .from("players")
      .select("email, phone")
      .in("email", ownerEmails)
      .not("phone", "is", null);
    for (const p of ownerPlayers ?? []) {
      const phone = (p.phone as string | null)?.trim();
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      phones.push(phone);
    }
  } else {
    for (const p of [...teamA.players, ...teamB.players]) {
      const phone = p.phone?.trim();
      if (!phone || seenPhones.has(phone)) continue;
      seenPhones.add(phone);
      phones.push(phone);
    }
  }

  if (phones.length === 0) {
    return { attempted: 0, delivered: 0, failures: [], sandbox, noopReason: "no_phones" };
  }

  const results = await Promise.all(
    phones.map(async (phone) => {
      const result = await sendTemplate({
        to: phone,
        template: TEMPLATE_NAME,
        bodyParams: [courtForBody, matchupLine],
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
    sandbox,
  };
}
