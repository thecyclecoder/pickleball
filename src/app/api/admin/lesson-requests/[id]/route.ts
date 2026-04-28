import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { isSuperAdmin, getCurrentMembership } from "@/lib/auth";
import { LESSON_REQUEST_STATUSES } from "@/lib/types";

async function loadAndAuthorize(id: string) {
  const admin = createAdminClient();
  const { data: row } = await admin
    .from("lesson_requests")
    .select("id, workspace_id")
    .eq("id", id)
    .maybeSingle();
  if (!row) return { ok: false as const, status: 404 };

  const membership = await getCurrentMembership();
  if (membership.status !== "ok") return { ok: false as const, status: 401 };
  if (isSuperAdmin(membership.user)) return { ok: true as const, row };
  if (row.workspace_id !== membership.member.workspace_id) {
    return { ok: false as const, status: 404 };
  }
  return { ok: true as const, row };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const found = await loadAndAuthorize(id);
  if (!found.ok) return NextResponse.json({ error: "Not found" }, { status: found.status });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  if (body.status !== undefined) {
    if (!(LESSON_REQUEST_STATUSES as readonly string[]).includes(body.status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    updates.status = body.status;
  }
  if (body.paid !== undefined) {
    updates.paid_at = body.paid ? new Date().toISOString() : null;
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("lesson_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ request: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;

  const found = await loadAndAuthorize(id);
  if (!found.ok) return NextResponse.json({ error: "Not found" }, { status: found.status });

  const admin = createAdminClient();
  const { error } = await admin.from("lesson_requests").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
