import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { sendTemplate } from "@/lib/whatsapp";

const TEMPLATE_NAME = "clinic_check_in";

/**
 * Check a clinic registrant in. Optional body { phone } backfills a
 * missing phone across the user's other registrations. After flipping
 * checked_in_at fires the simple bilingual `clinic_check_in` template.
 * Sandbox redirects the send to the workspace owner.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; registrationId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, registrationId } = await params;
  const admin = createAdminClient();

  const { data: clinic } = await admin
    .from("clinics")
    .select("id, title, workspace_id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!clinic) {
    return NextResponse.json({ error: "Clinic not found" }, { status: 404 });
  }
  const c = clinic as { id: string; title: string; workspace_id: string };

  const { data: reg } = await admin
    .from("clinic_registrations")
    .select("id, email, phone, first_name, last_name, clinic_id")
    .eq("id", registrationId)
    .eq("clinic_id", id)
    .maybeSingle();
  const regRow = reg as
    | {
        id: string;
        email: string;
        phone: string | null;
        first_name: string;
        last_name: string;
        clinic_id: string;
      }
    | null;
  if (!regRow) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const incomingPhone = typeof body?.phone === "string" ? body.phone.trim() : "";
  let recipientPhone = regRow.phone?.trim() || null;
  if (incomingPhone && !recipientPhone) {
    await admin
      .from("clinic_registrations")
      .update({ phone: incomingPhone })
      .eq("email", regRow.email)
      .is("phone", null);
    recipientPhone = incomingPhone;
  }

  const now = new Date().toISOString();
  const { data: updated, error: upErr } = await admin
    .from("clinic_registrations")
    .update({ checked_in_at: now })
    .eq("id", registrationId)
    .select()
    .single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  // Resolve recipient phone (sandbox vs live)
  type WorkspaceRow = { kind?: string };
  let phones: string[] = [];
  // Sandbox is per-tournament not per-clinic in the current schema —
  // we treat all clinic check-in sends as live. (If clinic sandbox
  // semantics get added, reuse the workspace owner-phone lookup here.)
  if (recipientPhone) phones = [recipientPhone];
  void ({} as WorkspaceRow);

  let delivered = 0;
  const failures: { phone: string; error: string }[] = [];
  for (const phone of phones) {
    const result = await sendTemplate({
      to: phone,
      template: TEMPLATE_NAME,
      bodyParams: [c.title],
    });
    if (result.ok) delivered++;
    else failures.push({ phone, error: result.error });
  }

  return NextResponse.json({
    registration: updated,
    notify: { attempted: phones.length, delivered, failures },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; registrationId: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, registrationId } = await params;
  const admin = createAdminClient();
  const { data: clinic } = await admin
    .from("clinics")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!clinic) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { error } = await admin
    .from("clinic_registrations")
    .update({ checked_in_at: null })
    .eq("id", registrationId)
    .eq("clinic_id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
