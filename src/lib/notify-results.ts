/**
 * Tournament-results email orchestrator.
 *
 * For each category in the tournament, computes:
 *   • Champion + runner-up (from the F game's winner / loser)
 *   • Semifinalists (the two SF losers; both treated equal — no
 *     3rd-place playoff)
 * Categories without a scored final are simply omitted.
 *
 * Recipients: every unique player (deduped by email) attached to a
 * non-cancelled team in the tournament. Sandbox mode redirects the
 * entire send to the workspace owner only and prefixes the subject
 * with [SANDBOX] so the dry run is unmistakable.
 *
 * Failures per-recipient are logged and counted but never thrown — a
 * single bounced address shouldn't kill the rest of the blast.
 */

import { sendTournamentResultsEmail } from "./email";
import { categoryLabel } from "./categories";
import type { createAdminClient } from "./supabase/admin";
import type { Game, Player, Team, TournamentCategory } from "./types";

type TeamRow = Team & { players: Player[] };

type Args = {
  admin: ReturnType<typeof createAdminClient>;
  tournament: {
    id: string;
    title: string;
    slug: string;
    workspace_id: string;
    sandbox_mode: boolean;
    start_date: string;
    location: string;
  };
  categories: TournamentCategory[];
  teams: TeamRow[];
  games: Game[];
};

export type ResultsNotifyOutcome = {
  attempted: number;
  delivered: number;
  failures: { email: string; error: string }[];
  sandbox: boolean;
};

function teamLabel(t: TeamRow | undefined): string {
  if (!t) return "—";
  const sorted = [...t.players].sort(
    (a, b) => Number(b.is_captain) - Number(a.is_captain)
  );
  return (
    sorted.map((p) => `${p.first_name} ${p.last_name.slice(0, 1)}.`).join(" / ") || "Team"
  );
}

function computeCategoryResults(
  category: TournamentCategory,
  teams: TeamRow[],
  games: Game[]
): {
  display: string;
  winnerLabel: string | null;
  runnerUpLabel: string | null;
  semifinalistLabels: string[];
} | null {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const catGames = games.filter((g) => g.category_id === category.id);

  const finalGame = catGames.find(
    (g) => g.stage === "f" && g.score_a != null && g.score_b != null
  );
  if (!finalGame || !finalGame.team_a_id || !finalGame.team_b_id || !finalGame.winner_team_id) {
    return null;
  }

  const winner = teamById.get(finalGame.winner_team_id);
  const runnerUpId =
    finalGame.team_a_id === finalGame.winner_team_id ? finalGame.team_b_id : finalGame.team_a_id;
  const runnerUp = teamById.get(runnerUpId);

  const sfLoserIds = catGames
    .filter((g) => g.stage === "sf" && g.score_a != null && g.score_b != null && g.winner_team_id)
    .map((g) =>
      g.winner_team_id === g.team_a_id ? g.team_b_id : g.team_a_id
    )
    .filter((id): id is string => !!id);
  const semifinalistLabels = sfLoserIds
    .map((id) => teamById.get(id))
    .filter((t): t is TeamRow => !!t)
    .map((t) => teamLabel(t));

  return {
    display: categoryLabel(category),
    winnerLabel: winner ? teamLabel(winner) : null,
    runnerUpLabel: runnerUp ? teamLabel(runnerUp) : null,
    semifinalistLabels,
  };
}

export async function notifyTournamentResults(args: Args): Promise<ResultsNotifyOutcome> {
  const { admin, tournament, categories, teams, games } = args;

  // Per-category results
  const categoryResults = categories
    .map((c) => computeCategoryResults(c, teams, games))
    .filter((r): r is NonNullable<typeof r> => !!r);

  // Recipient list
  type Recipient = { email: string; firstName: string };
  const seen = new Set<string>();
  const recipients: Recipient[] = [];

  if (tournament.sandbox_mode) {
    // Sandbox: redirect to owner only. Find their first-name from any
    // matching player record; default to a generic greeting if missing.
    const { data: ownerMembers } = await admin
      .from("workspace_members")
      .select("email")
      .eq("workspace_id", tournament.workspace_id)
      .eq("role", "owner");
    const ownerEmails = (ownerMembers ?? [])
      .map((m) => (m.email as string).toLowerCase())
      .filter(Boolean);
    if (ownerEmails.length === 0) {
      return { attempted: 0, delivered: 0, failures: [], sandbox: true };
    }
    const { data: ownerPlayers } = await admin
      .from("players")
      .select("email, first_name")
      .in("email", ownerEmails);
    const firstNameByEmail = new Map(
      (ownerPlayers ?? []).map((p) => [
        (p.email as string).toLowerCase(),
        (p.first_name as string) || "",
      ])
    );
    for (const e of ownerEmails) {
      if (seen.has(e)) continue;
      seen.add(e);
      recipients.push({ email: e, firstName: firstNameByEmail.get(e) || "Owner" });
    }
  } else {
    for (const t of teams) {
      if (t.status === "cancelled") continue;
      for (const p of t.players) {
        const email = (p.email ?? "").toLowerCase().trim();
        if (!email) continue;
        if (seen.has(email)) continue;
        seen.add(email);
        recipients.push({ email, firstName: p.first_name || "" });
      }
    }
  }

  if (recipients.length === 0) {
    return {
      attempted: 0,
      delivered: 0,
      failures: [],
      sandbox: tournament.sandbox_mode,
    };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const tournamentUrl = `${siteUrl}/tournaments/${tournament.slug}`;
  const whenWhereLine = `${tournament.start_date} · ${tournament.location}`;
  const subjectPrefix = tournament.sandbox_mode ? "[SANDBOX] " : "";

  const failures: { email: string; error: string }[] = [];
  const sends = await Promise.all(
    recipients.map(async (r) => {
      try {
        await sendTournamentResultsEmail({
          toEmail: r.email,
          toFirstName: r.firstName || "",
          tournamentTitle: tournament.title,
          whenWhereLine,
          tournamentUrl,
          categories: categoryResults,
          subjectPrefix,
        });
        return { ok: true as const, email: r.email };
      } catch (e) {
        return {
          ok: false as const,
          email: r.email,
          error: e instanceof Error ? e.message : String(e),
        };
      }
    })
  );
  for (const s of sends) {
    if (!s.ok) failures.push({ email: s.email, error: s.error });
  }

  return {
    attempted: recipients.length,
    delivered: recipients.length - failures.length,
    failures,
    sandbox: tournament.sandbox_mode,
  };
}
