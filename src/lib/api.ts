import { NextResponse } from "next/server";
import { getCurrentMembership } from "./auth";
import type { WorkspaceMember } from "./types";

export type AuthorizedContext = {
  member: WorkspaceMember;
};

export async function requireMember(): Promise<
  { ok: true; ctx: AuthorizedContext } | { ok: false; response: NextResponse }
> {
  const res = await getCurrentMembership();
  if (res.status === "anon") {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (res.status === "denied") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, ctx: { member: res.member } };
}

export async function requireOwnerOrAdmin(): Promise<
  { ok: true; ctx: AuthorizedContext } | { ok: false; response: NextResponse }
> {
  const res = await requireMember();
  if (!res.ok) return res;
  if (res.ctx.member.role !== "owner" && res.ctx.member.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return res;
}
