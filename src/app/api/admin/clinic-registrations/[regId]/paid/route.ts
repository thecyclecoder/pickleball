import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

/** PATCH /api/admin/clinic-registrations/<id>/paid { paid: bool } */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ regId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { regId } = await params;
  const admin = createAdminClient();

  const { data: reg } = await admin
    .from("clinic_registrations")
    .select("id, workspace_id")
    .eq("id", regId)
    .limit(1)
    .single();
  if (!reg || reg.workspace_id !== auth.ctx.member.workspace_id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  if (typeof body.paid !== "boolean") {
    return NextResponse.json({ error: "paid boolean required" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("clinic_registrations")
    .update({ paid_at: body.paid ? new Date().toISOString() : null })
    .eq("id", regId)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ registration: data });
}
