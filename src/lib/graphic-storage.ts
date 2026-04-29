/**
 * Rasterize an SVG to PNG via Sharp and upload both to Supabase
 * Storage. Reuses the existing `tournament-images` bucket with a
 * `graphics/` prefix so we don't have to provision a new bucket.
 *
 * Each call uses a timestamp-suffixed path so re-generations don't
 * collide and a regenerated graphic stays accessible at its old URL
 * for any external posts that already linked it.
 */

import sharp from "sharp";
import type { createAdminClient } from "./supabase/admin";
import type { GraphicType } from "./anthropic-graphic";

const BUCKET = "tournament-images";
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1350;

export type RasterizeAndUploadArgs = {
  admin: ReturnType<typeof createAdminClient>;
  tournamentId: string;
  type: GraphicType;
  svg: string;
};

export async function rasterizeAndUpload(args: RasterizeAndUploadArgs): Promise<{
  pngUrl: string;
  pngPath: string;
}> {
  const { admin, tournamentId, type, svg } = args;

  // Sharp infers SVG from the input buffer's content. Density bumps
  // keep small SVGs (text-heavy) from getting blurry — at 1x density
  // a 1080-wide SVG renders pixel-perfect, but Sonnet sometimes ships
  // SVGs declared smaller, so the resize() locks output dims regardless.
  const png = await sharp(Buffer.from(svg, "utf8"), { density: 96 })
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "fill" })
    .png()
    .toBuffer();

  // Only PNG goes to Storage; the SVG source lives in the DB row's
  // `svg` column (the bucket's image/* mime filter rejects svg+xml).
  const ts = Date.now();
  const pngPath = `graphics/${tournamentId}/${type}/${ts}.png`;

  const { error: pngErr } = await admin.storage
    .from(BUCKET)
    .upload(pngPath, png, { contentType: "image/png", upsert: false });
  if (pngErr) throw new Error(`storage upload (png): ${pngErr.message}`);

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(pngPath);
  return { pngUrl: urlData.publicUrl, pngPath };
}
