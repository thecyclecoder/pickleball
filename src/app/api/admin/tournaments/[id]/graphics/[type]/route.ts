import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import {
  generateTournamentGraphic,
  type GraphicType,
  type FeedbackEntry,
} from "@/lib/anthropic-graphic";
import { rasterizeAndUpload } from "@/lib/graphic-storage";
import { largestSrc, type TournamentImage } from "@/lib/types";

const VALID_TYPES = new Set<GraphicType>([
  "base",
  "pool_result",
  "bracket_qf",
  "bracket_sf",
  "bracket_f",
  "tournament_result",
]);

/**
 * Generate (or regenerate) a graphic template for the tournament.
 *
 * POST body (optional): { feedback?: string }. When provided, the
 * feedback is appended to feedback_history and passed to Sonnet
 * alongside the prior SVG so the regeneration applies the critique
 * on top of what was already there.
 *
 * Returns the freshly upserted row.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, type } = await params;
  if (!VALID_TYPES.has(type as GraphicType)) {
    return NextResponse.json({ error: `Unknown graphic type: ${type}` }, { status: 400 });
  }
  const graphicType = type as GraphicType;

  const admin = createAdminClient();
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id, title, images, flyer_image_url")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const t = tournament as {
    id: string;
    title: string;
    images: TournamentImage[] | null;
    flyer_image_url: string | null;
  };

  // Pick the reference image: largest size of the first slideshow image,
  // or the legacy flyer URL.
  let referenceImageUrl = "";
  if (t.images && t.images.length > 0) {
    referenceImageUrl = largestSrc(t.images[0]);
  }
  if (!referenceImageUrl && t.flyer_image_url) {
    referenceImageUrl = t.flyer_image_url;
  }
  if (!referenceImageUrl) {
    return NextResponse.json(
      { error: "Upload at least one tournament image before generating graphics" },
      { status: 400 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const feedback = typeof body?.feedback === "string" ? body.feedback.trim() : "";

  // Existing row (for prior SVG + feedback history)
  const { data: existing } = await admin
    .from("tournament_graphics")
    .select("svg, feedback_history")
    .eq("tournament_id", id)
    .eq("type", graphicType)
    .maybeSingle();
  const existingRow = existing as {
    svg: string;
    feedback_history: FeedbackEntry[];
  } | null;

  let svg: string;
  try {
    const result = await generateTournamentGraphic({
      type: graphicType,
      tournamentTitle: t.title,
      referenceImageUrl,
      priorSvg: existingRow?.svg,
      feedback: feedback || undefined,
      feedbackHistory: existingRow?.feedback_history ?? [],
    });
    svg = result.svg;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Sonnet generation failed" },
      { status: 502 }
    );
  }

  let pngUrl: string;
  try {
    const uploaded = await rasterizeAndUpload({
      admin,
      tournamentId: id,
      type: graphicType,
      svg,
    });
    pngUrl = uploaded.pngUrl;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Rasterize/upload failed" },
      { status: 500 }
    );
  }

  const newHistory: FeedbackEntry[] = [
    ...(existingRow?.feedback_history ?? []),
    ...(feedback ? [{ ts: new Date().toISOString(), prompt: feedback }] : []),
  ];

  const { data: upserted, error: upErr } = await admin
    .from("tournament_graphics")
    .upsert(
      {
        tournament_id: id,
        type: graphicType,
        svg,
        png_url: pngUrl,
        // Regeneration always resets approval — the new image needs
        // a fresh look-over before being marked good-to-go.
        approved: false,
        feedback_history: newHistory,
      },
      { onConflict: "tournament_id,type" }
    )
    .select()
    .single();
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ graphic: upserted });
}

/** PATCH — toggle the approved flag. Body: { approved: boolean }. */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, type } = await params;
  if (!VALID_TYPES.has(type as GraphicType)) {
    return NextResponse.json({ error: `Unknown graphic type: ${type}` }, { status: 400 });
  }
  const admin = createAdminClient();
  const body = await req.json().catch(() => ({}));
  if (typeof body?.approved !== "boolean") {
    return NextResponse.json({ error: "approved must be a boolean" }, { status: 400 });
  }

  // Verify ownership before mutating.
  const { data: tournament } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!tournament) {
    return NextResponse.json({ error: "Tournament not found" }, { status: 404 });
  }

  const { data, error } = await admin
    .from("tournament_graphics")
    .update({ approved: body.approved })
    .eq("tournament_id", id)
    .eq("type", type)
    .select()
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ graphic: data });
}

/** DELETE — drop the graphic row entirely (next generate starts fresh). */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; type: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id, type } = await params;
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
  await admin
    .from("tournament_graphics")
    .delete()
    .eq("tournament_id", id)
    .eq("type", type);
  return NextResponse.json({ ok: true });
}
