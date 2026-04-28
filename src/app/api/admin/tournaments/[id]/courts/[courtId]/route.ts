import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

async function assertOwned(
  admin: ReturnType<typeof createAdminClient>,
  tournamentId: string,
  courtId: string,
  workspaceId: string
) {
  const { data: t } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", tournamentId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!t) return false;
  const { data: c } = await admin
    .from("tournament_courts")
    .select("id")
    .eq("id", courtId)
    .eq("tournament_id", tournamentId)
    .maybeSingle();
  return !!c;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; courtId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, courtId } = await params;
  const admin = createAdminClient();
  if (!(await assertOwned(admin, id, courtId, auth.ctx.member.workspace_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if ("number" in body) {
    const n = Number(body.number);
    if (!Number.isFinite(n) || n <= 0) {
      return NextResponse.json({ error: "Invalid court number" }, { status: 400 });
    }
    updates.number = n;
  }
  if ("name" in body) {
    const v = (body.name ?? "").toString().trim();
    updates.name = v === "" ? null : v;
  }
  if ("sort_order" in body) {
    const s = Number(body.sort_order);
    updates.sort_order = Number.isFinite(s) ? s : 0;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("tournament_courts")
    .update(updates)
    .eq("id", courtId)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "Another court already has that number" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ court: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; courtId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, courtId } = await params;
  const admin = createAdminClient();
  if (!(await assertOwned(admin, id, courtId, auth.ctx.member.workspace_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  // Categories that referenced this court fall back to NULL (set null
  // FK on the migration), so deletion is safe.
  const { error } = await admin.from("tournament_courts").delete().eq("id", courtId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
