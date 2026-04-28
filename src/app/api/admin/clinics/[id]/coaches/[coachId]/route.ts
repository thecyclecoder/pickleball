import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

async function assertOwned(
  admin: ReturnType<typeof createAdminClient>,
  clinicId: string,
  coachId: string,
  workspaceId: string
) {
  const { data: c } = await admin
    .from("clinics")
    .select("id")
    .eq("id", clinicId)
    .eq("workspace_id", workspaceId)
    .limit(1)
    .single();
  if (!c) return false;
  const { data: coach } = await admin
    .from("clinic_coaches")
    .select("id")
    .eq("id", coachId)
    .eq("clinic_id", clinicId)
    .limit(1)
    .single();
  return !!coach;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; coachId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, coachId } = await params;
  const admin = createAdminClient();
  if (!(await assertOwned(admin, id, coachId, auth.ctx.member.workspace_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const k of ["name", "title", "image_url", "sort_order"]) {
    if (k in body) {
      const v = body[k];
      updates[k] = v === "" ? null : v;
    }
  }
  if ("name" in updates && typeof updates.name === "string") {
    updates.name = (updates.name as string).trim();
    if (!updates.name) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("clinic_coaches")
    .update(updates)
    .eq("id", coachId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coach: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; coachId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, coachId } = await params;
  const admin = createAdminClient();
  if (!(await assertOwned(admin, id, coachId, auth.ctx.member.workspace_id))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { error } = await admin.from("clinic_coaches").delete().eq("id", coachId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
