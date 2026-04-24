import { NextResponse } from "next/server";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { IMAGE_WIDTHS, type TournamentImage } from "@/lib/types";

export const runtime = "nodejs";

const MAX_BYTES = 25 * 1024 * 1024; // cap raw upload at 25 MB before transcoding
const ALLOWED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];
const BUCKET = "tournament-images";

export async function POST(req: Request) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.type && !ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: `Unsupported type: ${file.type}` }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Image must be under 25 MB" }, { status: 400 });
  }

  const admin = createAdminClient();
  const id = crypto.randomUUID();
  const basePath = `${auth.ctx.member.workspace_id}/${id}`;

  let srcsetEntries: { w: number; url: string }[];
  try {
    const input = Buffer.from(await file.arrayBuffer());

    // Re-encode each size to WebP, letting sharp choose the best source frame
    // (auto-rotate via EXIF orientation, never enlarge beyond original).
    const base = sharp(input, { failOn: "none" }).rotate();
    const meta = await base.metadata();
    const srcWidth = meta.width ?? Math.max(...IMAGE_WIDTHS);

    srcsetEntries = await Promise.all(
      IMAGE_WIDTHS.map(async (w) => {
        const targetWidth = Math.min(w, srcWidth);
        const buf = await sharp(input, { failOn: "none" })
          .rotate()
          .resize({ width: targetWidth, withoutEnlargement: true, fit: "inside" })
          .webp({ quality: 82, effort: 4 })
          .toBuffer();

        const objectPath = `${basePath}-${w}.webp`;
        const { error: upErr } = await admin.storage
          .from(BUCKET)
          .upload(objectPath, buf, {
            contentType: "image/webp",
            upsert: false,
            cacheControl: "31536000, immutable",
          });
        if (upErr) throw new Error(upErr.message);

        const { data: pub } = admin.storage.from(BUCKET).getPublicUrl(objectPath);
        return { w, url: pub.publicUrl };
      })
    );
  } catch (e) {
    return NextResponse.json(
      { error: `Image processing failed: ${(e as Error).message}` },
      { status: 500 }
    );
  }

  const image: TournamentImage = { srcset: srcsetEntries };
  return NextResponse.json({ image });
}
