import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { uniqueClinicSlug } from "@/lib/slug";

const ALLOWED = [
  "title",
  "title_es",
  "description",
  "description_es",
  "details",
  "details_es",
  "flyer_image_url",
  "images",
  "start_date",
  "end_date",
  "start_time",
  "timezone",
  "location",
  "location_es",
  "address",
  "address_es",
  "google_maps_url",
  "status",
  "registration_open",
  "capacity",
  "payment_qr_url",
  "payment_instructions",
  "payment_instructions_es",
] as const;

async function loadOwned(admin: ReturnType<typeof createAdminClient>, id: string, workspaceId: string) {
  const { data } = await admin
    .from("clinics")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .limit(1)
    .single();
  return data;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("clinics")
    .select(`*, coaches:clinic_coaches (*), registrations:clinic_registrations (*)`)
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .limit(1)
    .single();
  if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ clinic: data });
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const existing = await loadOwned(admin, id, auth.ctx.member.workspace_id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const updates: Record<string, unknown> = {};
  for (const f of ALLOWED) {
    if (f in body) updates[f] = body[f] === "" ? null : body[f];
  }

  if (typeof updates.title === "string" && updates.title.trim() && updates.title !== existing.title) {
    updates.slug = await uniqueClinicSlug(admin, updates.title as string, id);
  }

  const { data, error } = await admin
    .from("clinics")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clinic: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { error } = await admin
    .from("clinics")
    .delete()
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
