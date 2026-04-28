import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireOwnerOrAdmin } from "@/lib/api";

export async function GET() {
  const auth = await requireOwnerOrAdmin();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("email_aliases")
    .select("*")
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ aliases: data ?? [] });
}

export async function POST(req: Request) {
  const auth = await requireOwnerOrAdmin();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const localPart = (body.local_part ?? "").toString().trim().toLowerCase();
  const forwardTo = (body.forward_to_email ?? "").toString().trim().toLowerCase();

  if (!/^[a-z0-9][a-z0-9._-]*$/.test(localPart) || localPart.length > 64) {
    return NextResponse.json(
      { error: "Local part must be lowercase letters/numbers with optional . _ -" },
      { status: 400 }
    );
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forwardTo)) {
    return NextResponse.json(
      { error: "Valid forward-to email is required" },
      { status: 400 }
    );
  }
  if (forwardTo.endsWith("@buentiro.app")) {
    // Forwarding to ourselves would loop on every inbound — block it.
    return NextResponse.json(
      { error: "Forward-to cannot be a buentiro.app address" },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  // Auth context's user_id comes from getCurrentMembership but we don't
  // need to thread it through requireOwnerOrAdmin — fetch separately.
  const meRes = await import("@/lib/auth").then((m) => m.getCurrentMembership());
  const createdBy = meRes.status === "ok" ? meRes.user.id : null;

  const { data, error } = await admin
    .from("email_aliases")
    .insert({
      workspace_id: auth.ctx.member.workspace_id,
      local_part: localPart,
      forward_to_email: forwardTo,
      created_by_user_id: createdBy,
    })
    .select()
    .single();
  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        { error: `${localPart}@buentiro.app is already taken` },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ alias: data });
}
