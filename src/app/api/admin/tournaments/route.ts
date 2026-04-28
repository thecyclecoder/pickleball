import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { uniqueTournamentSlug } from "@/lib/slug";

export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("tournaments")
    .select(
      `*,
       categories:tournament_categories (id, team_limit),
       teams (id, status)`
    )
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .order("start_date", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tournaments: data });
}

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  // Coach-kind workspaces don't run tournaments. Reject server-side so
  // the menu's nav-level hide isn't the only guard.
  const admin0 = createAdminClient();
  const { data: ws } = await admin0
    .from("workspaces")
    .select("kind")
    .eq("id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (ws?.kind === "coach") {
    return NextResponse.json(
      { error: "This workspace is set up as a coach. Switch to a club to create tournaments." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const {
    title,
    title_es,
    description,
    description_es,
    details,
    details_es,
    flyer_image_url,
    images,
    start_date,
    end_date,
    start_time,
    timezone,
    location,
    location_es,
    address,
    address_es,
    google_maps_url,
    status,
    registration_open,
    payment_qr_url,
    payment_instructions,
    payment_instructions_es,
  } = body;

  if (!title?.trim()) return NextResponse.json({ error: "Title is required" }, { status: 400 });
  if (!start_date) return NextResponse.json({ error: "Start date is required" }, { status: 400 });
  if (!start_time) return NextResponse.json({ error: "Start time is required" }, { status: 400 });
  if (!location?.trim()) return NextResponse.json({ error: "Location is required" }, { status: 400 });

  const admin = createAdminClient();
  const slug = await uniqueTournamentSlug(admin, title);

  const { data, error } = await admin
    .from("tournaments")
    .insert({
      workspace_id: auth.ctx.member.workspace_id,
      slug,
      title: title.trim(),
      title_es: title_es ?? null,
      description: description ?? null,
      description_es: description_es ?? null,
      details: details ?? null,
      details_es: details_es ?? null,
      flyer_image_url: flyer_image_url ?? null,
      images: Array.isArray(images) ? images : [],
      start_date,
      end_date: end_date || null,
      start_time,
      timezone: timezone || "America/Puerto_Rico",
      location: location.trim(),
      location_es: location_es ?? null,
      address: address ?? null,
      address_es: address_es ?? null,
      google_maps_url: google_maps_url ?? null,
      status: status || "draft",
      registration_open: registration_open ?? true,
      payment_qr_url: payment_qr_url ?? null,
      payment_instructions: payment_instructions ?? null,
      payment_instructions_es: payment_instructions_es ?? null,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tournament: data });
}
