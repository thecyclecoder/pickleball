import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { InviteAcceptClient } from "./accept-client";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const admin = createAdminClient();

  const { data: member } = await admin
    .from("workspace_members")
    .select("id, email, role, joined_at, workspace:workspaces (id, name)")
    .eq("id", id)
    .maybeSingle();

  if (!member) notFound();

  const workspace = (member as unknown as { workspace: { id: string; name: string } }).workspace;

  // If user is already signed in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const signedInMatches =
    user?.email && user.email.toLowerCase() === member.email.toLowerCase();

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <p className="mb-3 text-xs font-medium uppercase tracking-[0.2em] text-emerald-500">
          You&apos;re invited
        </p>
        <h1 className="mb-2 text-2xl font-bold text-white">
          Join {workspace.name}
        </h1>
        <p className="mb-6 text-sm text-zinc-400">
          Invited as <span className="font-medium text-white">{member.email}</span> · role{" "}
          <span className="font-medium text-white">{member.role}</span>
        </p>

        {member.joined_at ? (
          <div className="rounded-lg border border-zinc-800 bg-zinc-950 p-4 text-sm text-zinc-300">
            This invite has already been accepted.
            <div className="mt-3">
              <Link
                href="/admin"
                className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Go to admin →
              </Link>
            </div>
          </div>
        ) : signedInMatches ? (
          <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200">
            You&apos;re already signed in as <strong>{user.email}</strong>.
            <div className="mt-3">
              <Link
                href="/admin"
                className="inline-block rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
              >
                Open admin →
              </Link>
            </div>
          </div>
        ) : (
          <InviteAcceptClient
            invitedEmail={member.email}
            currentUserEmail={user?.email ?? null}
          />
        )}
      </div>
    </div>
  );
}
