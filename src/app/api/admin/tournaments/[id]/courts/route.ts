import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireMember } from "@/lib/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: t } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await admin
    .from("tournament_courts")
    .select("*")
    .eq("tournament_id", id)
    .order("sort_order", { ascending: true })
    .order("number", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ courts: data ?? [] });
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireMember();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  const admin = createAdminClient();

  const { data: t } = await admin
    .from("tournaments")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", auth.ctx.member.workspace_id)
    .maybeSingle();
  if (!t) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const number = Number(body.number);
  const name = (body.name ?? "").toString().trim() || null;
  const sortOrder = Number(body.sort_order ?? 0);

  if (!Number.isFinite(number) || number <= 0) {
    return NextResponse.json({ error: "Court number must be a positive integer" }, { status: 400 });
  }

  const { data, error } = await admin
    .from("tournament_courts")
    .insert({
      tournament_id: id,
      number,
      name,
      sort_order: sortOrder,
    })
    .select()
    .single();
  if (error) {
    // Friendlier message on the unique (tournament_id, number) collision
    if (error.code === "23505") {
      return NextResponse.json({ error: `Court ${number} already exists` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ court: data });
}
