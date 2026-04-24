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

async function own(admin: ReturnType<typeof createAdminClient>, id: string, workspaceId: string) {
  const { data } = await admin
    .from("tournament_formats")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .limit(1)
    .single();
  return !!data;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  if (!(await own(admin, id, auth.ctx.member.workspace_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const f of ALLOWED_FIELDS) {
    if (f in body) updates[f] = body[f];
  }
  const { data, error } = await admin
    .from("tournament_formats")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ format: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  if (!(await own(admin, id, auth.ctx.member.workspace_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { error } = await admin.from("tournament_formats").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
