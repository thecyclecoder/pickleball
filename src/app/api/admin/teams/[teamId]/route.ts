import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

const TEAM_STATUS = ["registered", "confirmed", "waitlisted", "cancelled"] as const;
const PAYMENT_STATUS = ["unpaid", "paid", "refunded"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { teamId } = await params;
  const admin = createAdminClient();

  // Verify team belongs to this workspace
  const { data: team } = await admin
    .from("teams")
    .select("id, workspace_id")
    .eq("id", teamId)
    .limit(1)
    .single();
  if (!team || team.workspace_id !== auth.ctx.member.workspace_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!(TEAM_STATUS as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (body.payment_status !== undefined) {
    if (!(PAYMENT_STATUS as readonly string[]).includes(body.payment_status)) {
      return NextResponse.json({ error: "Invalid payment_status" }, { status: 400 });
    }
    updates.payment_status = body.payment_status;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("teams")
    .update(updates)
    .eq("id", teamId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ team: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ teamId: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { teamId } = await params;
  const admin = createAdminClient();

  const { data: team } = await admin
    .from("teams")
    .select("id, workspace_id")
    .eq("id", teamId)
    .limit(1)
    .single();
  if (!team || team.workspace_id !== auth.ctx.member.workspace_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { error } = await admin.from("teams").delete().eq("id", teamId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
