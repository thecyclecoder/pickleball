import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: clinic } = await admin
    .from("clinics")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .limit(1)
    .single();
  if (!clinic) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const name = (body.name ?? "").toString().trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await admin
    .from("clinic_coaches")
    .insert({
      clinic_id: id,
      name,
      title: body.title?.toString().trim() || null,
      image_url: body.image_url || null,
      sort_order: Number(body.sort_order ?? 0),
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ coach: data });
}
