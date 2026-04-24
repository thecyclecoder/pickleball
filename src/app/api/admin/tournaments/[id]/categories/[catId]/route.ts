import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

async function assertOwned(
  admin: ReturnType<typeof createAdminClient>,
  tournamentId: string,
  catId: string,
  workspaceId: string
) {
  const { data: t } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .eq("workspace_id", workspaceId)
    .limit(1)
    .single();
  if (!t) return false;
  const { data: c } = await admin
    .from("tournament_categories")
    .select("id")
    .eq("id", catId)
    .eq("tournament_id", tournamentId)
    .limit(1)
    .single();
  return !!c;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, catId } = await params;
  const admin = createAdminClient();
  if (!(await assertOwned(admin, id, catId, auth.ctx.member.workspace_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const key of ["type", "rating", "label", "label_es", "team_limit", "sort_order", "format_id"]) {
    if (key in body) updates[key] = body[key];
  }
  if ("label" in updates && typeof updates.label === "string") {
    updates.label = (updates.label as string).trim() || null;
  }
  if ("label_es" in updates && typeof updates.label_es === "string") {
    updates.label_es = (updates.label_es as string).trim() || null;
  }

  const { data, error } = await admin
    .from("tournament_categories")
    .update(updates)
    .eq("id", catId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; catId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, catId } = await params;
  const admin = createAdminClient();
  if (!(await assertOwned(admin, id, catId, auth.ctx.member.workspace_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { error } = await admin.from("tournament_categories").delete().eq("id", catId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
