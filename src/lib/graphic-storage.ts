/**
 * Compose a tournament graphic by layering: backdrop image (fetched
 * server-side, NOT via SVG <image href>) → translucent dark overlay
 * → Sonnet-generated SVG (text + shapes, transparent background).
 *
 * librsvg can't reliably fetch external URLs from <image> tags, so we
 * keep the SVG free of bitmap references and do the composite in
 * Sharp where image fetching/resizing/blending is well-defined.
 *
 * Reuses the existing `tournament-images` bucket with a `graphics/`
 * prefix. The SVG source lives in the tournament_graphics.svg DB
 * column — only the rendered PNG is uploaded.
 */

import sharp from "sharp";
import type { createAdminClient } from "./supabase/admin";
import type { GraphicType } from "./anthropic-graphic";

const BUCKET = "tournament-images";
const TARGET_WIDTH = 1080;
const TARGET_HEIGHT = 1350;
/** 0–1. How dark the overlay between backdrop and SVG is. Tuned so
 *  white text stays readable on most reference images. */
const DARKEN_ALPHA = 0.55;

export type RasterizeAndUploadArgs = {
  admin: ReturnType<typeof createAdminClient>;
  tournamentId: string;
  type: GraphicType;
  svg: string;
  /** Public URL of the tournament's reference image. Composited under
   *  the SVG. If the fetch fails, falls back to a solid dark canvas. */
  referenceImageUrl: string;
};

async function fetchBackdrop(url: string): Promise<Buffer | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    return Buffer.from(await res.arrayBuffer());
  } catch {
    return null;
  }
}

export async function rasterizeAndUpload(args: RasterizeAndUploadArgs): Promise<{
  pngUrl: string;
  pngPath: string;
}> {
  const { admin, tournamentId, type, svg, referenceImageUrl } = args;

  // 1. Backdrop — fetch + resize-cover. Falls back to a solid dark
  //    canvas if the fetch fails so we still produce something.
  const backdropBuf = await fetchBackdrop(referenceImageUrl);
  const backdrop = backdropBuf
    ? await sharp(backdropBuf)
        .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "cover" })
        .toBuffer()
    : await sharp({
        create: {
          width: TARGET_WIDTH,
          height: TARGET_HEIGHT,
          channels: 3,
          background: { r: 9, g: 9, b: 11 },
        },
      })
        .png()
        .toBuffer();

  // 2. Darkening layer — flat semi-transparent black covering the canvas.
  const darkOverlay = await sharp({
    create: {
      width: TARGET_WIDTH,
      height: TARGET_HEIGHT,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: DARKEN_ALPHA },
    },
  })
    .png()
    .toBuffer();

  // 3. SVG overlay — Sonnet's output. Density 96 matches the SVG's
  //    declared 1080-wide canvas; resize locks final dims either way.
  const svgOverlay = await sharp(Buffer.from(svg, "utf8"), { density: 96 })
    .resize(TARGET_WIDTH, TARGET_HEIGHT, { fit: "fill" })
    .png()
    .toBuffer();

  // 4. Composite: backdrop → dark overlay → SVG.
  const png = await sharp(backdrop)
    .composite([
      { input: darkOverlay, blend: "over" },
      { input: svgOverlay, blend: "over" },
    ])
    .png()
    .toBuffer();

  const ts = Date.now();
  const pngPath = `graphics/${tournamentId}/${type}/${ts}.png`;
  const { error: pngErr } = await admin.storage
    .from(BUCKET)
    .upload(pngPath, png, { contentType: "image/png", upsert: false });
  if (pngErr) throw new Error(`storage upload (png): ${pngErr.message}`);

  const { data: urlData } = admin.storage.from(BUCKET).getPublicUrl(pngPath);
  return { pngUrl: urlData.publicUrl, pngPath };
}
