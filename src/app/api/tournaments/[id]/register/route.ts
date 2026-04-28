import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { RATING_OPTIONS } from "@/lib/types";
import { categoryLabel } from "@/lib/categories";
import { formatTournamentDate, formatTime } from "@/lib/format";
import { generateMagicLink, sendRegistrationEmail } from "@/lib/email";
import { sendPushToUsers } from "@/lib/push-server";

type PlayerInput = {
  first_name?: string;
  last_name?: string;
  email?: string;
  rating?: string | number;
};

type Body = {
  category_id?: string;
  player1?: PlayerInput;
  player2?: PlayerInput;
};

function sanitizePlayer(p: PlayerInput | undefined, who: "Player 1" | "Player 2") {
  if (!p) throw new Error(`${who} is required`);
  const first = (p.first_name ?? "").trim();
  const last = (p.last_name ?? "").trim();
  const email = (p.email ?? "").trim().toLowerCase();
  const rating = String(p.rating ?? "").trim();
  if (!first) throw new Error(`${who}: first name is required`);
  if (!last) throw new Error(`${who}: last name is required`);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`${who}: valid email is required`);
  if (!(RATING_OPTIONS as readonly string[]).includes(rating)) {
    throw new Error(`${who}: rating must be one of ${RATING_OPTIONS.join(", ")}`);
  }
  return { first_name: first, last_name: last, email, rating: Number(rating) };
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);
  const admin = createAdminClient();

  const body = (await req.json().catch(() => ({}))) as Body;

  let p1, p2;
  try {
    p1 = sanitizePlayer(body.player1, "Player 1");
    p2 = sanitizePlayer(body.player2, "Player 2");
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  if (p1.email === p2.email) {
    return NextResponse.json({ error: "Players must have different emails" }, { status: 400 });
  }
  if (!body.category_id) {
    return NextResponse.json({ error: "Category is required" }, { status: 400 });
  }

  // Look up tournament
  const tLookup = isUuid
    ? admin.from("tournaments").select("*").eq("id", id).limit(1)
    : admin.from("tournaments").select("*").eq("slug", id).limit(1);
  const { data: tRows, error: tErr } = await tLookup;
  if (tErr) return NextResponse.json({ error: tErr.message }, { status: 500 });
  const tournament = tRows?.[0];
  if (!tournament || tournament.status !== "published") {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }
  if (!tournament.registration_open) {
    return NextResponse.json({ error: "Registration is closed" }, { status: 400 });
  }

  // Validate category belongs to tournament
  const { data: cat, error: cErr } = await admin
    .from("tournament_categories")
    .select("*")
    .eq("id", body.category_id)
    .eq("tournament_id", tournament.id)
    .limit(1)
    .single();
  if (cErr || !cat) return NextResponse.json({ error: "Category not found" }, { status: 404 });

  // Check duplicate email in same category (excluding cancelled teams)
  const { data: dupTeams } = await admin
    .from("teams")
    .select("id, status, players!inner(email)")
    .eq("category_id", cat.id)
    .neq("status", "cancelled");
  const existingEmails = new Set<string>();
  for (const t of (dupTeams ?? []) as unknown as { players: { email: string }[] }[]) {
    for (const pl of t.players) existingEmails.add(pl.email.toLowerCase());
  }
  if (existingEmails.has(p1.email) || existingEmails.has(p2.email)) {
    return NextResponse.json(
      { error: "One of these emails is already registered in this category" },
      { status: 409 }
    );
  }

  // Count active teams in category, split by status. If the roster is at
  // team_limit, the next team goes onto the waitlist — unless the category
  // also has a waitlist_limit and that's full too, in which case we reject
  // with 409 (matches the clinic auto-close behavior).
  const { data: activeRows } = await admin
    .from("teams")
    .select("status")
    .eq("category_id", cat.id)
    .neq("status", "cancelled");
  const registeredCount = (activeRows ?? []).filter((t) => t.status === "registered").length;
  const waitlistedCount = (activeRows ?? []).filter((t) => t.status === "waitlisted").length;

  let status: "registered" | "waitlisted" = "registered";
  if (registeredCount >= cat.team_limit) {
    if (cat.waitlist_limit != null && waitlistedCount >= cat.waitlist_limit) {
      return NextResponse.json(
        { error: "This category is full. Registration is closed." },
        { status: 409 }
      );
    }
    status = "waitlisted";
  }

  // Create team
  const { data: team, error: teamErr } = await admin
    .from("teams")
    .insert({
      tournament_id: tournament.id,
      category_id: cat.id,
      workspace_id: tournament.workspace_id,
      status,
    })
    .select()
    .single();
  if (teamErr || !team) {
    return NextResponse.json({ error: teamErr?.message ?? "Failed to create team" }, { status: 500 });
  }

  // If the submitter is signed in and matches one of the player emails,
  // link that player directly (the DB trigger also covers the email match).
  const currentUser = await getCurrentUser();
  const currentEmail =
    currentUser && currentUser.email ? currentUser.email.toLowerCase() : null;

  // Create players
  const { error: playersErr } = await admin.from("players").insert([
    {
      team_id: team.id,
      ...p1,
      is_captain: true,
      user_id: currentEmail && p1.email === currentEmail ? currentUser!.id : null,
    },
    {
      team_id: team.id,
      ...p2,
      is_captain: false,
      user_id: currentEmail && p2.email === currentEmail ? currentUser!.id : null,
    },
  ]);
  if (playersErr) {
    // Roll back team
    await admin.from("teams").delete().eq("id", team.id);
    return NextResponse.json({ error: playersErr.message }, { status: 500 });
  }

  // Best-effort side effects — both emails and admin pushes. Logged on
  // failure but never block the client's redirect to the splash.
  await Promise.all([
    sendRegistrationEmails({ tournament, category: cat, team, p1, p2 }).catch((e) =>
      console.error("Registration emails failed:", e)
    ),
    notifyWorkspaceAdmins({ tournament, category: cat, p1, p2, waitlisted: status === "waitlisted" }).catch(
      (e) => console.error("Registration push failed:", e)
    ),
  ]);

  return NextResponse.json({ team_id: team.id, status });
}

async function sendRegistrationEmails(args: {
  tournament: {
    id: string;
    slug: string;
    title: string;
    start_date: string;
    end_date: string | null;
    start_time: string;
    timezone: string;
    location: string;
  };
  category: { type: "MD" | "WD" | "MXD"; rating: string; label: string | null };
  team: { id: string; status: string };
  p1: { first_name: string; last_name: string; email: string };
  p2: { first_name: string; last_name: string; email: string };
}) {
  const { tournament, category, team, p1, p2 } = args;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";
  const tournamentUrl = `${siteUrl}/tournaments/${tournament.slug}`;
  const waitlisted = team.status === "waitlisted";
  const catLabel = categoryLabel({
    type: category.type,
    rating: category.rating,
    label: category.label ?? null,
  });
  const dateLabel = formatTournamentDate(
    tournament.start_date,
    tournament.end_date,
    tournament.timezone
  );
  const timeLabel = formatTime(tournament.start_time, tournament.timezone);

  const [link1, link2] = await Promise.all([
    generateMagicLink(p1.email).catch((e) => {
      console.error("magic link p1 failed:", e);
      return `${siteUrl}/login`;
    }),
    generateMagicLink(p2.email).catch((e) => {
      console.error("magic link p2 failed:", e);
      return `${siteUrl}/login`;
    }),
  ]);

  await Promise.all([
    sendRegistrationEmail({
      toEmail: p1.email,
      toFirstName: p1.first_name,
      partnerFullName: `${p2.first_name} ${p2.last_name}`,
      tournamentTitle: tournament.title,
      tournamentStartDateLabel: dateLabel,
      tournamentTimeLabel: timeLabel,
      tournamentLocation: tournament.location,
      categoryLabel: catLabel,
      tournamentUrl,
      confirmLink: link1,
      waitlisted,
      mode: "self",
    }),
    sendRegistrationEmail({
      toEmail: p2.email,
      toFirstName: p2.first_name,
      partnerFullName: `${p1.first_name} ${p1.last_name}`,
      tournamentTitle: tournament.title,
      tournamentStartDateLabel: dateLabel,
      tournamentTimeLabel: timeLabel,
      tournamentLocation: tournament.location,
      categoryLabel: catLabel,
      tournamentUrl,
      confirmLink: link2,
      waitlisted,
      mode: "partner",
      submitterFirstName: p1.first_name,
    }),
  ]);
}

async function notifyWorkspaceAdmins(args: {
  tournament: { id: string; slug: string; title: string; workspace_id: string };
  category: { type: "MD" | "WD" | "MXD"; rating: string; label: string | null };
  p1: { first_name: string; last_name: string };
  p2: { first_name: string; last_name: string };
  waitlisted: boolean;
}) {
  const admin = createAdminClient();
  const { data: members } = await admin
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", args.tournament.workspace_id)
    .in("role", ["owner", "admin"])
    .not("user_id", "is", null);

  const userIds = (members ?? [])
    .map((m) => m.user_id as string | null)
    .filter((v): v is string => !!v);
  if (userIds.length === 0) return;

  const catLabel = categoryLabel({
    type: args.category.type,
    rating: args.category.rating,
    label: args.category.label ?? null,
  });

  await sendPushToUsers(userIds, {
    title: args.waitlisted
      ? `Waitlist: ${args.tournament.title}`
      : `New team: ${args.tournament.title}`,
    body: `${args.p1.first_name} ${args.p1.last_name} / ${args.p2.first_name} ${args.p2.last_name} — ${catLabel}`,
    tag: `registration:${args.tournament.id}`,
    url: `/admin/tournaments/${args.tournament.id}`,
  });
}
