/**
 * Tournament-start blast: tells every active player their pool, their
 * full pool schedule, and (for round-1 teams) "you're up first, head
 * to court N".
 *
 * Channel routing per recipient:
 *   • Has phone → WhatsApp (template: tournament_starting_pool or
 *     tournament_starting_first_match)
 *   • No phone → email (sendTournamentStartEmail)
 *
 * Sandbox mode collapses the recipient list down to the workspace
 * owner only and prefixes the tournament name with [SANDBOX]. Channel
 * still depends on whether the owner has a phone on file.
 *
 * Failures don't throw per-recipient — the blast keeps going. Outcomes
 * are returned for logging.
 */

import { sendTemplate } from "./whatsapp";
import { sendTournamentStartEmail } from "./email";
import type { createAdminClient } from "./supabase/admin";
import type { Game, Player, Team, TournamentCourt, TournamentPool } from "./types";

type PlayerRow = Pick<Player, "first_name" | "last_name" | "email" | "phone">;
type TeamRow = Pick<Team, "id" | "category_id" | "pool_id" | "status"> & {
  players: PlayerRow[];
};

type Args = {
  admin: ReturnType<typeof createAdminClient>;
  tournament: {
    id: string;
    title: string;
    slug: string;
    workspace_id: string;
    sandbox_mode: boolean;
  };
};

export type TournamentStartOutcome = {
  attempted: number;
  whatsappDelivered: number;
  emailDelivered: number;
  failures: { target: string; channel: "whatsapp" | "email"; error: string }[];
  sandbox: boolean;
};

function teamLabel(players: PlayerRow[]): string {
  if (players.length === 0) return "Team";
  return players.map((p) => `${p.first_name} ${p.last_name}`).join(" & ");
}

function formatScheduleLine(
  game: Game,
  teamById: Map<string, TeamRow>,
  courtById: Map<string, TournamentCourt>
): string {
  const a = teamById.get(game.team_a_id ?? "");
  const b = teamById.get(game.team_b_id ?? "");
  const matchup = `${teamLabel(a?.players ?? [])} vs ${teamLabel(b?.players ?? [])}`;
  const court = game.court_id ? courtById.get(game.court_id) : null;
  const courtLabel = court ? `Court ${court.number}` : "";
  return `R${game.round} - ${matchup}${courtLabel ? ` · ${courtLabel}` : ""}`;
}

export async function notifyTournamentStart(args: Args): Promise<TournamentStartOutcome> {
  const { admin, tournament } = args;
  const sandbox = tournament.sandbox_mode;

  // Pull everything for this tournament in one shot.
  const { data: pools } = await admin
    .from("tournament_pools")
    .select("id, letter, sort_order, category_id")
    .in(
      "category_id",
      // Subquery via filter — Supabase's PostgREST allows .in() on raw values
      // so we'll fetch category ids first.
      // Easier: fetch by joining categories on tournament_id.
      []
    );
  // Fallback: fetch categories first, then pools/games scoped by category.
  const { data: cats } = await admin
    .from("tournament_categories")
    .select("id")
    .eq("tournament_id", tournament.id);
  const categoryIds = (cats ?? []).map((c) => c.id as string);
  if (categoryIds.length === 0) {
    return { attempted: 0, whatsappDelivered: 0, emailDelivered: 0, failures: [], sandbox };
  }

  const [{ data: poolRows }, { data: gameRows }, { data: teamRows }, { data: courtRows }] =
    await Promise.all([
      admin
        .from("tournament_pools")
        .select("id, letter, sort_order, category_id")
        .in("category_id", categoryIds),
      admin.from("games").select("*").in("category_id", categoryIds).eq("stage", "pool"),
      admin
        .from("teams")
        .select("id, category_id, pool_id, status, players (first_name, last_name, email, phone)")
        .in("category_id", categoryIds),
      admin
        .from("tournament_courts")
        .select("id, number, name, sort_order, tournament_id, created_at")
        .eq("tournament_id", tournament.id),
    ]);
  void pools; // shadowed by poolRows
  const allPools = (poolRows ?? []) as (TournamentPool & { category_id: string })[];
  const allGames = (gameRows ?? []) as Game[];
  const allTeams = (teamRows ?? []) as unknown as TeamRow[];
  const allCourts = (courtRows ?? []) as TournamentCourt[];

  const courtById = new Map(allCourts.map((c) => [c.id, c]));
  const teamById = new Map(allTeams.map((t) => [t.id, t]));
  const poolById = new Map(allPools.map((p) => [p.id, p]));

  // Per-pool: schedule string + the first game (lowest round + sort_order)
  const scheduleByPool = new Map<string, string>();
  const firstGameByPool = new Map<string, Game>();
  for (const pool of allPools) {
    const poolGames = allGames
      .filter((g) => g.pool_id === pool.id)
      .sort((a, b) => a.round - b.round || a.sort_order - b.sort_order);
    if (poolGames.length === 0) continue;
    const lines = poolGames.map((g) => formatScheduleLine(g, teamById, courtById));
    scheduleByPool.set(pool.id, lines.join("\n"));
    firstGameByPool.set(pool.id, poolGames[0]);
  }

  // Build per-recipient context (deduped by email).
  type Recipient = {
    email: string;
    firstName: string;
    phone: string | null;
    poolLetter: string;
    schedule: string;
    isFirstMatch: boolean;
    firstMatchCourtLabel: string | null;
  };
  const seenEmails = new Set<string>();
  const recipients: Recipient[] = [];
  for (const team of allTeams) {
    if (team.status === "cancelled") continue;
    if (!team.pool_id) continue;
    const pool = poolById.get(team.pool_id);
    if (!pool) continue;
    const schedule = scheduleByPool.get(team.pool_id) ?? "";
    const firstGame = firstGameByPool.get(team.pool_id) ?? null;
    const isFirstMatch = !!firstGame &&
      (firstGame.team_a_id === team.id || firstGame.team_b_id === team.id);
    const firstMatchCourt =
      isFirstMatch && firstGame?.court_id ? courtById.get(firstGame.court_id) : null;
    const firstMatchCourtLabel = firstMatchCourt ? `Court ${firstMatchCourt.number}` : null;

    for (const p of team.players) {
      const email = (p.email ?? "").toLowerCase().trim();
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      recipients.push({
        email,
        firstName: p.first_name || "",
        phone: p.phone?.trim() || null,
        poolLetter: pool.letter,
        schedule,
        isFirstMatch,
        firstMatchCourtLabel,
      });
    }
  }

  // Sandbox: replace recipient list with a single owner entry.
  let finalRecipients: Recipient[] = recipients;
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
      return { attempted: 0, whatsappDelivered: 0, emailDelivered: 0, failures: [], sandbox };
    }
    // Pull owner's name + phone via any matching player row.
    const { data: ownerPlayer } = await admin
      .from("players")
      .select("first_name, phone")
      .in("email", ownerEmails)
      .limit(1)
      .maybeSingle();
    const owner = ownerPlayer as { first_name: string | null; phone: string | null } | null;
    // Use the FIRST recipient's pool/schedule context as the sandbox sample
    // — gives the owner a representative end-to-end preview of what real
    // players see. Falls back to any-pool context if no live recipients.
    const sample = recipients[0];
    if (!sample) {
      return { attempted: 0, whatsappDelivered: 0, emailDelivered: 0, failures: [], sandbox };
    }
    finalRecipients = [
      {
        email: ownerEmails[0],
        firstName: owner?.first_name || "Owner",
        phone: owner?.phone?.trim() || null,
        poolLetter: sample.poolLetter,
        schedule: sample.schedule,
        isFirstMatch: sample.isFirstMatch,
        firstMatchCourtLabel: sample.firstMatchCourtLabel,
      },
    ];
  }

  if (finalRecipients.length === 0) {
    return { attempted: 0, whatsappDelivered: 0, emailDelivered: 0, failures: [], sandbox };
  }

  const titleForBody = sandbox ? `[SANDBOX] ${tournament.title}` : tournament.title;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const tournamentUrl = `${siteUrl}/tournaments/${tournament.slug}`;

  const failures: TournamentStartOutcome["failures"] = [];
  let whatsappDelivered = 0;
  let emailDelivered = 0;

  for (const r of finalRecipients) {
    if (r.phone) {
      const params = r.isFirstMatch
        ? [titleForBody, r.poolLetter, r.firstMatchCourtLabel ?? "Court", r.schedule]
        : [titleForBody, r.poolLetter, r.schedule];
      const result = await sendTemplate({
        to: r.phone,
        template: r.isFirstMatch
          ? "first_match_call"
          : "pool_schedule_call",
        bodyParams: params,
      });
      if (result.ok) {
        whatsappDelivered++;
      } else {
        failures.push({ target: r.phone, channel: "whatsapp", error: result.error });
      }
    } else {
      try {
        await sendTournamentStartEmail({
          toEmail: r.email,
          toFirstName: r.firstName,
          tournamentTitle: titleForBody,
          poolLetter: r.poolLetter,
          schedule: r.schedule,
          isFirstMatch: r.isFirstMatch,
          firstMatchCourtLabel: r.firstMatchCourtLabel,
          tournamentUrl,
          subjectPrefix: sandbox ? "[SANDBOX] " : "",
        });
        emailDelivered++;
      } catch (e) {
        failures.push({
          target: r.email,
          channel: "email",
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  }

  return {
    attempted: finalRecipients.length,
    whatsappDelivered,
    emailDelivered,
    failures,
    sandbox,
  };
}
