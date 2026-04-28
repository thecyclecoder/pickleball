import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();
  const isUuid = /^[0-9a-f-]{36}$/i.test(id);

  const query = admin
    .from("clinics")
    .select(
      `*,
       workspace:workspaces (id, name),
       coaches:clinic_coaches (*),
       registrations:clinic_registrations (id, first_name, last_name, rating_self, age, status)`
    )
    .limit(1);
  const { data, error } = isUuid ? await query.eq("id", id) : await query.eq("slug", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const clinic = data?.[0];
  if (!clinic) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (clinic.status !== "published") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ clinic });
}
