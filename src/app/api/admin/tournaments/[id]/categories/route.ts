import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";
import { CATEGORY_TYPES } from "@/lib/types";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  // Confirm ownership
  const { data: t } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .limit(1)
    .single();
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const type = body.type;
  const rating = (body.rating ?? "").toString();
  const label = body.label ?? null;
  const label_es = body.label_es ?? null;
  const teamLimit = Number(body.team_limit ?? 16);
  const sortOrder = Number(body.sort_order ?? 0);
  const formatId = body.format_id ?? null;
  const poolCount =
    body.pool_count === null || body.pool_count === undefined || body.pool_count === ""
      ? null
      : Number(body.pool_count);
  const advancePerPool =
    body.advance_per_pool === null || body.advance_per_pool === undefined || body.advance_per_pool === ""
      ? null
      : Number(body.advance_per_pool);

  if (!CATEGORY_TYPES.includes(type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (!rating) return NextResponse.json({ error: "Rating is required" }, { status: 400 });
  if (!Number.isFinite(teamLimit) || teamLimit <= 0) {
    return NextResponse.json({ error: "Invalid team limit" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("tournament_categories")
    .insert({
      tournament_id: id,
      type,
      rating,
      label: label?.trim() || null,
      label_es: label_es?.trim() || null,
      team_limit: teamLimit,
      sort_order: sortOrder,
      format_id: formatId,
      pool_count: poolCount,
      advance_per_pool: advancePerPool,
    })
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ category: data });
}
