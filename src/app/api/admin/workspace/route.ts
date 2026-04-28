import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .select("*")
    .eq("id", auth.ctx.member.workspace_id)
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspace: data });
}

export async function PATCH(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  if (auth.ctx.member.role !== "owner" && auth.ctx.member.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
  if (body.payment_info && typeof body.payment_info === "object") {
    updates.payment_info = body.payment_info;
  }
  if (body.kind === "club" || body.kind === "coach") {
    if (auth.ctx.member.role !== "owner") {
      return NextResponse.json({ error: "Only owners can change workspace type" }, { status: 403 });
    }
    updates.kind = body.kind;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspaces")
    .update(updates)
    .eq("id", auth.ctx.member.workspace_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspace: data });
}
