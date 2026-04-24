import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

const ALLOWED_FIELDS = [
  "name",
  "description",
  "pool_play_games_to",
  "pool_play_win_by",
  "pool_play_best_of",
  "pool_play_advance_per_pool",
  "has_quarterfinals",
  "quarterfinals_games_to",
  "quarterfinals_win_by",
  "quarterfinals_best_of",
  "has_semifinals",
  "semifinals_games_to",
  "semifinals_win_by",
  "semifinals_best_of",
  "has_finals",
  "finals_games_to",
  "finals_win_by",
  "finals_best_of",
] as const;

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tournament_formats")
    .select("*")
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ formats: data });
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const body = await req.json().catch(() => ({}));
  if (!body.name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  const row: Record<string, unknown> = {
    workspace_id: auth.ctx.member.workspace_id,
  };
  for (const f of ALLOWED_FIELDS) {
    if (f in body) row[f] = body[f];
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tournament_formats")
    .insert(row)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ format: data });
}
