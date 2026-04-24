import { redirect } from "next/navigation";
import { getCurrentMembership } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** PWA launch router. The manifest's start_url points here so that tapping
 *  the installed icon opens the right destination based on who's signed in:
 *
 *    - Logged out                → "/"   (marketing landing)
 *    - Logged in + workspace member  → "/admin"
 *    - Logged in + regular player    → "/me"
 *
 *  Browser users who visit the landing at "/" directly still see the
 *  marketing page; this route is only the PWA entry point. */
export default async function LaunchPage() {
  const res = await getCurrentMembership();
  if (res.status === "anon") redirect("/");
  if (res.status === "ok") redirect("/admin");
  // status === "denied" (signed in but not a workspace member) → player
  redirect("/me");
}
