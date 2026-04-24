import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import type { User } from "@supabase/supabase-js";
import type { WorkspaceMember } from "./types";

export type MembershipResult =
  | { status: "anon" }
  | { status: "denied"; user: User }
  | { status: "ok"; user: User; member: WorkspaceMember };

/** Loads the current user's workspace membership. Returns the single
 *  membership row if present (the app is scoped to one workspace per user). */
export async function getCurrentMembership(): Promise<MembershipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anon" };

  const admin = createAdminClient();
  const { data: members } = await admin
    .from("workspace_members")
    .select("*")
    .or(`user_id.eq.${user.id},email.ilike.${user.email ?? ""}`)
    .limit(1);

  const member = members?.[0] as WorkspaceMember | undefined;
  if (!member) return { status: "denied", user };

  // Link user_id on first load if the trigger didn't run yet
  if (!member.user_id && user.email && member.email.toLowerCase() === user.email.toLowerCase()) {
    await admin
      .from("workspace_members")
      .update({ user_id: user.id, joined_at: new Date().toISOString() })
      .eq("id", member.id);
    member.user_id = user.id;
  }

  return { status: "ok", user, member };
}
