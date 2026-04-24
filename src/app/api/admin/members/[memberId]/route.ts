import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrAdmin } from "@/lib/api";

export async function DELETE(_req: Request, { params }: { params: Promise<{ memberId: string }> }) {
  const auth = await requireOwnerOrAdmin();
  if (!auth.ok) return auth.response;
  const { memberId } = await params;
  const admin = createAdminClient();

  const { data: target } = await admin
    .from("workspace_members")
    .select("*")
    .eq("id", memberId)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .limit(1)
    .single();
  if (!target) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (target.role === "owner") {
    return NextResponse.json({ error: "Cannot remove the owner" }, { status: 400 });
  }
  if (target.id === auth.ctx.member.id) {
    return NextResponse.json({ error: "Cannot remove yourself" }, { status: 400 });
  }

  const { error } = await admin.from("workspace_members").delete().eq("id", memberId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
