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
  "waitlist_capacity",
  "payment_qr_url",
  "payment_instructions",
  "payment_instructions_es",
] as const;

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clinics")
    .select(`*, registrations:clinic_registrations (id, status)`)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .order("start_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clinics: data });
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  if (!body.title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!body.start_date) return NextResponse.json({ error: "Start date is required" }, { status: 400 });
  if (!body.start_time) return NextResponse.json({ error: "Start time is required" }, { status: 400 });
  if (!body.location?.trim())
    return NextResponse.json({ error: "Location is required" }, { status: 400 });

  const admin = createAdminClient();
  const slug = await uniqueClinicSlug(admin, body.title);

  const row: Record<string, unknown> = {
    workspace_id: auth.ctx.member.workspace_id,
    slug,
  };
  for (const f of ALLOWED) {
    if (f in body) row[f] = body[f] === "" ? null : body[f];
  }

  const { data, error } = await admin.from("clinics").insert(row).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clinic: data });
}
