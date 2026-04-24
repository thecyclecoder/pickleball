import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// [id] accepts either UUID or slug
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const isUuid = /^[0-9a-f-]{36}$/i.test(id);

  const query = admin
    .from("tournaments")
    .select(
      `*,
       workspace:workspaces (id, name, payment_info),
       categories:tournament_categories (*),
       teams (
         id, status, payment_status, category_id, registered_at,
         players (id, first_name, last_name, email, rating, is_captain)
       )`
    )
    .limit(1);

  const { data, error } = isUuid
    ? await query.eq("id", id)
    : await query.eq("slug", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const tournament = data?.[0];
  if (!tournament) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (tournament.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ tournament });
}
