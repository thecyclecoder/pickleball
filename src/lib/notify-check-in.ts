/**
 * Tournament check-in WhatsApp confirmation. Fired by the admin
 * check-in endpoint after a player is marked checked-in.
 *
 * Sends the bilingual `tournament_check_in` template with their pool,
 * partner name, and first-match summary. Sandbox redirects to the
 * workspace owner (same rule as the other notifiers).
 *
 * Failures are logged but never throw — check-in is the source of
 * truth even if WhatsApp is down.
 */

import { sendTemplate } from "./whatsapp";
import type { createAdminClient } from "./supabase/admin";
import type { Game, Player } from "./types";

const TEMPLATE_NAME = "tournament_check_in";

type MinimalPlayer = Pick<Player, "first_name" | "last_name" | "phone" | "email">;

export type CheckInNotifyOutcome = {
  attempted: number;
  delivered: number;
  failures: { phone: string; error: string }[];
  sandbox: boolean;
};

function teamLabel(players: MinimalPlayer[]): string {
  if (players.length === 0) return "your partner";
  return players.map((p) => `${p.first_name} ${p.last_name}`).join(" & ");
}

export async function notifyCheckIn(args: {
  admin: ReturnType<typeof createAdminClient>;
  tournament: { id: string; title: string; workspace_id: string; sandbox_mode: boolean };
  /** The team the just-checked-in player is on. Used to compute pool +
   *  partner name + first match. */
  teamId: string;
  /** The phone of the player being checked in (live mode only). */
  recipientPhone: string | null;
}): Promise<CheckInNotifyOutcome> {
  const { admin, tournament, teamId, recipientPhone } = args;
  const sandbox = tournament.sandbox_mode;

  // Pull team + partner + pool + first game in one shot
  const { data: team } = await admin
    .from("teams")
    .select(
      `id, pool_id,
       players (first_name, last_name, phone, email),
       pool:tournament_pools (id, letter)`
    )
    .eq("id", teamId)
    .maybeSingle();
  const teamRow = team as unknown as
    | {
        id: string;
        pool_id: string | null;
        players: MinimalPlayer[];
        pool: { id: string; letter: string } | null;
      }
    | null;
  if (!teamRow || !teamRow.pool || teamRow.players.length === 0) {
    return { attempted: 0, delivered: 0, failures: [], sandbox };
  }
  const poolLetter = teamRow.pool.letter;

  // First game for this team in their pool, sorted by round/sort_order
  const { data: poolGames } = await admin
    .from("games")
    .select("*")
    .eq("pool_id", teamRow.pool.id)
    .eq("stage", "pool")
    .or(`team_a_id.eq.${teamId},team_b_id.eq.${teamId}`)
    .order("round", { ascending: true })
    .order("sort_order", { ascending: true })
    .limit(1);
  const firstGame = (poolGames ?? [])[0] as Game | undefined;

  let firstMatchLine = "TBD";
  if (firstGame) {
    const opponentId =
      firstGame.team_a_id === teamId ? firstGame.team_b_id : firstGame.team_a_id;
    let opponentLabel = "TBD";
    if (opponentId) {
      const { data: opp } = await admin
        .from("teams")
        .select("id, players (first_name, last_name, phone, email)")
        .eq("id", opponentId)
        .maybeSingle();
      const oppRow = opp as unknown as { players: MinimalPlayer[] } | null;
      if (oppRow) opponentLabel = teamLabel(oppRow.players);
    }
    let courtLabel = "";
    if (firstGame.court_id) {
      const { data: court } = await admin
        .from("tournament_courts")
        .select("number")
        .eq("id", firstGame.court_id)
        .maybeSingle();
      if (court) courtLabel = ` · Court ${(court as { number: number }).number}`;
    }
    firstMatchLine = `R${firstGame.round} · vs ${opponentLabel}${courtLabel}`;
  }

  // Partner = the OTHER player(s) on this team (everyone except the
  // recipient). For doubles (2 players) this is just the one partner.
  const recipient = teamRow.players.find(
    (p) => p.phone?.trim() === recipientPhone?.trim() && !!recipientPhone
  );
  const partners = recipient
    ? teamRow.players.filter((p) => p !== recipient)
    : teamRow.players;
  const partnerName = teamLabel(partners);

  const titleForBody = sandbox ? `[SANDBOX] ${tournament.title}` : tournament.title;
  const params = [titleForBody, poolLetter, partnerName, firstMatchLine];

  // Resolve recipient phone(s)
  let phones: string[] = [];
  if (sandbox) {
    const { data: ownerMembers } = await admin
      .from("workspace_members")
      .select("email")
      .eq("workspace_id", tournament.workspace_id)
      .eq("role", "owner");
    const ownerEmails = (ownerMembers ?? [])
      .map((m) => (m.email as string).toLowerCase())
      .filter(Boolean);
    if (ownerEmails.length > 0) {
      const { data: ownerPlayers } = await admin
        .from("players")
        .select("phone")
        .in("email", ownerEmails)
        .not("phone", "is", null);
      phones = (ownerPlayers ?? [])
        .map((p) => (p.phone as string | null)?.trim())
        .filter((p): p is string => !!p);
    }
  } else if (recipientPhone) {
    phones = [recipientPhone];
  }

  if (phones.length === 0) {
    return { attempted: 0, delivered: 0, failures: [], sandbox };
  }

  const results = await Promise.all(
    phones.map(async (phone) => {
      const result = await sendTemplate({
        to: phone,
        template: TEMPLATE_NAME,
        language: "en",
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
    sandbox,
  };
}
