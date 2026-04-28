import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
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

/** GET — return the workspace's coach profile (or null if not yet created). */
export async function GET() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coach_profiles")
    .select("*")
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

/** PUT — upsert the workspace's coach profile. Single profile per workspace. */
export async function PUT(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const body = await req.json().catch(() => ({}));
  const displayName = (body.display_name ?? "").toString().trim();
  if (!displayName) {
    return NextResponse.json({ error: "Display name is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("coach_profiles")
    .select("id, slug, display_name")
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();

  const updates: Record<string, unknown> = {};
  for (const f of ALLOWED) {
    if (f in body) updates[f] = body[f] === "" ? null : body[f];
  }
  updates.display_name = displayName;

  if (!existing) {
    // Create
    updates.workspace_id = auth.ctx.member.workspace_id;
    updates.slug = await uniqueCoachSlug(admin, displayName);
    const { data, error } = await admin
      .from("coach_profiles")
      .insert(updates)
      .select()
      .single();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ profile: data });
  }

  // Update — regenerate slug if the display name changed
  if (displayName !== existing.display_name) {
    updates.slug = await uniqueCoachSlug(admin, displayName, existing.id);
  }
  const { data, error } = await admin
    .from("coach_profiles")
    .update(updates)
    .eq("id", existing.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profile: data });
}

/** DELETE — remove the workspace's coach profile. */
export async function DELETE() {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const admin = createAdminClient();
  const { error } = await admin
    .from("coach_profiles")
    .delete()
    .eq("workspace_id", auth.ctx.member.workspace_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
