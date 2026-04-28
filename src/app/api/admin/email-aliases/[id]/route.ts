import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrAdmin } from "@/lib/api";

async function load(
  admin: ReturnType<typeof createAdminClient>,
  id: string,
  workspaceId: string
) {
  const { data } = await admin
    .from("email_aliases")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerOrAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const existing = await load(admin, id, auth.ctx.member.workspace_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if ("forward_to_email" in body) {
    const v = (body.forward_to_email ?? "").toString().trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      return NextResponse.json({ error: "Valid email required" }, { status: 400 });
    }
    if (v.endsWith("@buentiro.app")) {
      return NextResponse.json(
        { error: "Forward-to cannot be a buentiro.app address" },
        { status: 400 }
      );
    }
    updates.forward_to_email = v;
  }
  if ("active" in body) {
    updates.active = !!body.active;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("email_aliases")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ alias: data });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireOwnerOrAdmin();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const existing = await load(admin, id, auth.ctx.member.workspace_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await admin.from("email_aliases").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
