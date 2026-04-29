import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { notifyTournamentResults } from "@/lib/notify-results";
import type { Game, Player, Team, TournamentCategory } from "@/lib/types";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data } = await admin
    .from("tournaments")
    .select(
      `id, title, slug, workspace_id, sandbox_mode, start_date, location,
       categories:tournament_categories ( *, games (*) ),
       teams ( *, players (*) )`
    )
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!data) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const tour = data as unknown as {
    id: string;
    title: string;
    slug: string;
    workspace_id: string;
    sandbox_mode: boolean;
    start_date: string;
    location: string;
    categories: (TournamentCategory & { games: Game[] })[];
    teams: (Team & { players: Player[] })[];
  };

  const categories: TournamentCategory[] = tour.categories.map((c) => {
    const { ...rest } = c;
    return rest as TournamentCategory;
  });
  const games: Game[] = tour.categories.flatMap((c) => c.games ?? []);

  const outcome = await notifyTournamentResults({
    admin,
    tournament: {
      id: tour.id,
      title: tour.title,
      slug: tour.slug,
      workspace_id: tour.workspace_id,
      sandbox_mode: tour.sandbox_mode,
      start_date: tour.start_date,
      location: tour.location,
    },
    categories,
    teams: tour.teams,
    games,
  });

  return NextResponse.json(outcome);
}
