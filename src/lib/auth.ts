import { cookies } from "next/headers";
import { createClient } from "./supabase/server";
import { createAdminClient } from "./supabase/admin";
import type { User } from "@supabase/supabase-js";
import type { WorkspaceMember } from "./types";

export const ACTIVE_WORKSPACE_COOKIE = "active_workspace_id";

/** True when the current user is the site-wide super-admin (owner of the
 *  whole system, can create workspaces for others). All other users —
 *  including workspace owners/admins — can belong to and switch between
 *  workspaces but cannot create new ones. Set via SUPER_ADMIN_EMAIL. */
export function isSuperAdmin(user: User | null): boolean {
  if (!user?.email) return false;
  const allowed = (process.env.SUPER_ADMIN_EMAIL ?? "").toLowerCase().trim();
  if (!allowed) return false;
  return user.email.toLowerCase() === allowed;
}

export type MembershipResult =
  | { status: "anon" }
  | { status: "denied"; user: User }
  | {
      status: "ok";
      user: User;
      member: WorkspaceMember;
      allMemberships: WorkspaceMember[];
      canCreateWorkspace: boolean;
    };

/** Returns the currently-signed-in user, or null. No membership check. */
export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** Resolve the current user's workspace membership. Handles multi-workspace
 *  users via a cookie-scoped "active workspace". Callers that only need one
 *  value can use `result.member`; callers that render a switcher use
 *  `result.allMemberships`. Returns `denied` if the user has no memberships. */
export async function getCurrentMembership(): Promise<MembershipResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "anon" };

  const admin = createAdminClient();
  const email = (user.email ?? "").toLowerCase();
  const { data: rows } = await admin
    .from("workspace_members")
    .select("*")
    .or(`user_id.eq.${user.id}${email ? `,email.ilike.${email}` : ""}`)
    .order("invited_at", { ascending: true });

  const memberships = (rows ?? []) as WorkspaceMember[];
  if (memberships.length === 0) return { status: "denied", user };

  // Link any by-email-only rows to the user_id now that we know who they are
  const unlinked = memberships.filter(
    (m) => !m.user_id && m.email.toLowerCase() === email
  );
  if (unlinked.length > 0) {
    const now = new Date().toISOString();
    await admin
      .from("workspace_members")
      .update({ user_id: user.id, joined_at: now })
      .in(
        "id",
        unlinked.map((m) => m.id)
      );
    for (const m of unlinked) {
      m.user_id = user.id;
      if (!m.joined_at) m.joined_at = now;
    }
  }

  const cookieStore = await cookies();
  const activeId = cookieStore.get(ACTIVE_WORKSPACE_COOKIE)?.value;
  const active =
    memberships.find((m) => m.workspace_id === activeId) ?? memberships[0];

  return {
    status: "ok",
    user,
    member: active,
    allMemberships: memberships,
    canCreateWorkspace: isSuperAdmin(user),
  };
}
