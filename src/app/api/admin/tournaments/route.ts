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
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ tournament: data });
}
