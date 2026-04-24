import { NextResponse } from "next/server";
import { ACTIVE_WORKSPACE_COOKIE, getCurrentMembership } from "@/lib/auth";

export async function POST(req: Request) {
  const res = await getCurrentMembership();
  if (res.status !== "ok") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const workspaceId = body.workspace_id as string | undefined;
  if (!workspaceId) {
    return NextResponse.json({ error: "workspace_id required" }, { status: 400 });
  }
  const valid = res.allMemberships.some((m) => m.workspace_id === workspaceId);
  if (!valid) {
    return NextResponse.json({ error: "Not a member of that workspace" }, { status: 403 });
  }
  const out = NextResponse.json({ ok: true, workspace_id: workspaceId });
  out.cookies.set(ACTIVE_WORKSPACE_COOKIE, workspaceId, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return out;
}
