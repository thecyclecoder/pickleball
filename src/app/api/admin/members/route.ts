import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrAdmin, requireMember } from "@/lib/api";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_members")
    .select("*")
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .order("invited_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ members: data });
}

export async function POST(req: Request) {
  const auth = await requireOwnerOrAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const email = (body.email ?? "").toString().trim().toLowerCase();
  const role = (body.role ?? "member").toString();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }
  if (!["admin", "member"].includes(role)) {
    return NextResponse.json({ error: "Role must be admin or member" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("workspace_members")
    .insert({
      workspace_id: auth.ctx.member.workspace_id,
      email,
      role,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "This email is already invited" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ member: data });
}
