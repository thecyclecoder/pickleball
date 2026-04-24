import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { ACTIVE_WORKSPACE_COOKIE, getCurrentMembership } from "@/lib/auth";

export async function GET() {
  const res = await getCurrentMembership();
  if (res.status !== "ok") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const admin = createAdminClient();
  const ids = res.allMemberships.map((m) => m.workspace_id);
  if (ids.length === 0) return NextResponse.json({ workspaces: [] });
  const { data, error } = await admin
    .from("workspaces")
    .select("*")
    .in("id", ids)
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workspaces: data });
}

export async function POST(req: Request) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!res.canCreateWorkspace) {
    return NextResponse.json(
      { error: "Only workspace owners can create new workspaces." },
      { status: 403 }
    );
  }
  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  const ownerEmail = res.user.email;
  if (!ownerEmail) {
    return NextResponse.json({ error: "Missing owner email" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: workspace, error } = await admin
    .from("workspaces")
    .insert({ name, owner_email: ownerEmail })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The DB trigger already inserted a workspace_members row; link it to user_id now.
  await admin
    .from("workspace_members")
    .update({ user_id: res.user.id, joined_at: new Date().toISOString() })
    .eq("workspace_id", workspace.id)
    .eq("email", ownerEmail);

  // Switch active workspace to the new one
  const out = NextResponse.json({ workspace });
  out.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspace.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return out;
}
