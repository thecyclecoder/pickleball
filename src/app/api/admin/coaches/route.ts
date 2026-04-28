import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentMembership, isSuperAdmin } from "@/lib/auth";

/** GET /api/admin/coaches — every coach profile across every workspace.
 *  Super-admin only. */
export async function GET() {
  const auth = await getCurrentMembership();
  if (auth.status !== "ok") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isSuperAdmin(auth.user)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("coach_profiles")
    .select(`*, workspace:workspaces (id, name, owner_email)`)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ profiles: data });
}
