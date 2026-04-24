import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data: tournaments, error } = await admin
    .from("tournaments")
    .select(
      `id, slug, title, description, flyer_image_url, start_date, end_date,
       start_time, timezone, location, status, registration_open,
       categories:tournament_categories (id, type, rating, label, team_limit, sort_order),
       teams (id, status, category_id)`
    )
    .eq("status", "published")
    .order("start_date", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Reduce team rows to per-category active counts
  type Row = (typeof tournaments)[number] & {
    teams: { id: string; status: string; category_id: string }[];
    categories: { id: string; team_limit: number }[];
  };
  const shaped = (tournaments ?? []).map((t) => {
    const row = t as unknown as Row;
    const activeByCategory = new Map<string, number>();
    for (const team of row.teams ?? []) {
      if (team.status === "cancelled") continue;
      activeByCategory.set(team.category_id, (activeByCategory.get(team.category_id) ?? 0) + 1);
    }
    const totalActive = Array.from(activeByCategory.values()).reduce((a, b) => a + b, 0);
    const totalLimit = (row.categories ?? []).reduce((a, c) => a + c.team_limit, 0);
    const { teams, ...rest } = row;
    void teams;
    return { ...rest, active_team_count: totalActive, total_team_limit: totalLimit };
  });

  return NextResponse.json({ tournaments: shaped });
}
