import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
const BUCKET = "tournament-images";
const TARGET_W = 1080;
const TARGET_H = 1350;

/**
 * Upload (or replace) the per-tournament template image. The image is
 * resized to 1080×1350 (cover) so all data overlays line up to the
 * same coordinate system, then stored in the tournament-images bucket
 * at templates/<tournament>/<ts>.png. The URL gets stored on the
 * tournament_graphics row with type='template'.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: tournament } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 25 MB" }, { status: 400 });
  }

  const input = Buffer.from(await file.arrayBuffer());
  const png = await sharp(input, { failOn: "none" })
    .rotate()
    .resize(TARGET_W, TARGET_H, { fit: "cover" })
    .png()
    .toBuffer();

  const ts = Date.now();
  const path = `templates/${id}/${ts}.png`;
  const { error: upErr } = await admin.storage
    .from(BUCKET)
    .upload(path, png, { contentType: "image/png", upsert: false });
  if (upErr) {
    return NextResponse.json({ error: `upload: ${upErr.message}` }, { status: 500 });
  }
  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(path);

  // Replace any existing template row. Delete-then-insert avoids
  // upsert-on-coalesce-index quirks (the unique index uses
  // coalesce(target_key, '') which PostgREST's onConflict doesn't
  // see as a conflict target).
  await admin
    .from("tournament_graphics")
    .delete()
    .eq("tournament_id", id)
    .eq("type", "template");
  const { data: row, error: rowErr } = await admin
    .from("tournament_graphics")
    .insert({
      tournament_id: id,
      type: "template",
      target_key: null,
      svg: null,
      png_url: urlData.publicUrl,
      approved: true, // template is just a backdrop — always "approved"
    })
    .select()
    .single();
  if (rowErr) {
    return NextResponse.json({ error: rowErr.message }, { status: 500 });
  }

  return NextResponse.json({ template: row });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await admin
    .from("tournament_graphics")
    .delete()
    .eq("tournament_id", id)
    .eq("type", "template");
  return NextResponse.json({ ok: true });
}
