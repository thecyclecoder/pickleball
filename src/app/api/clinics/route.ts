import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("clinics")
    .select(
      `id, slug, title, title_es, description, description_es, flyer_image_url, images,
       start_date, end_date, start_time, timezone, location, location_es, capacity,
       registration_open,
       coaches:clinic_coaches (id, name, title, image_url, sort_order),
       registrations:clinic_registrations (id, status)`
    )
    .eq("status", "published")
    .order("start_date", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ clinics: data });
}
