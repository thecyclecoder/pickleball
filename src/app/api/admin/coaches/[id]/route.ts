import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";
import { uniqueCoachSlug } from "@/lib/slug";

const ALLOWED = [
  "display_name",
  "display_name_es",
  "tagline",
  "tagline_es",
  "bio",
  "bio_es",
  "images",
  "avatar_url",
  "languages",
  "lesson_types",
  "skill_levels",
  "price_notes",
  "price_notes_es",
  "service_area",
  "service_area_es",
  "certifications",
  "certifications_es",
  "years_coaching",
  "dupr_rating",
  "status",
  "accepting_requests",
] as const;

async function requireSuperAdmin() {
  const auth = await getCurrentMembership();
  if (auth.status !== "ok") {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!isSuperAdmin(auth.user)) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true as const };
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coach_profiles")
    .select(`*, workspace:workspaces (id, name, owner_email)`)
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ profile: data });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;
  const { id } = await params;

  const body = await req.json().catch(() => ({}));
  const displayName = (body.display_name ?? "").toString().trim();
  if (!displayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("coach_profiles")
    .select("id, slug, display_name")
    .eq("id", id)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updates: Record<string, unknown> = {};
  for (const f of ALLOWED) {
    if (f in body) updates[f] = body[f] === "" ? null : body[f];
  }
  updates.display_name = displayName;
  if (displayName !== existing.display_name) {
    updates.slug = await uniqueCoachSlug(admin, displayName, existing.id);
  }

  const { data, error } = await admin
    .from("coach_profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireSuperAdmin();
  if (!gate.ok) return gate.response;
  const { id } = await params;
  const admin = createAdminClient();
  const { error } = await admin.from("coach_profiles").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
