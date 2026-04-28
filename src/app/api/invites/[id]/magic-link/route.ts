import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateMagicLink, sendInviteMagicLink } from "@/lib/email";

/** POST /api/invites/<id>/magic-link
 *
 *  Sends a magic-link sign-in email to the address on the invite. The
 *  invite ID is the workspace_members row id, which is opaque enough
 *  (UUID) to stand in for "knowledge of the invite" — no other auth
 *  required, since the link itself is single-use and lands on /admin
 *  after sign-in. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("workspace_members")
    .select("id, email, joined_at, workspace:workspaces (name)")
    .eq("id", id)
    .maybeSingle();
  if (!member) {
    return NextResponse.json({ error: "Invite not found" }, { status: 404 });
  }
  if (member.joined_at) {
    return NextResponse.json(
      { error: "This invite has already been accepted." },
      { status: 400 }
    );
  }

  const workspace = (member as unknown as { workspace: { name: string } | null }).workspace;
  const workspaceName = workspace?.name ?? "Buen Tiro";

  try {
    const link = await generateMagicLink(member.email, "/admin");
    await sendInviteMagicLink({
      toEmail: member.email,
      workspaceName,
      confirmLink: link,
    });
  } catch (e) {
    console.error("Invite magic-link failed:", e);
    return NextResponse.json({ error: "Could not send sign-in link" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, email: member.email });
}
