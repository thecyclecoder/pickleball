import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

const STATUS = ["registered", "waitlisted", "cancelled"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ regId: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { regId } = await params;
  const admin = createAdminClient();

  const { data: reg } = await admin
    .from("clinic_registrations")
    .select("id, workspace_id")
    .eq("id", regId)
    .limit(1)
    .single();
  if (!reg || reg.workspace_id !== auth.ctx.member.workspace_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!(STATUS as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("clinic_registrations")
    .update(updates)
    .eq("id", regId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ registration: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ regId: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { regId } = await params;
  const admin = createAdminClient();

  const { data: reg } = await admin
    .from("clinic_registrations")
    .select("id, workspace_id")
    .eq("id", regId)
    .limit(1)
    .single();
  if (!reg || reg.workspace_id !== auth.ctx.member.workspace_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await admin.from("clinic_registrations").delete().eq("id", regId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
