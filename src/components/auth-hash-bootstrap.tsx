"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Handles the URL-hash-based implicit flow that Supabase uses for
 *  admin-generated magic links. When a recipient clicks the link in an
 *  email, they land on our site with `#access_token=…&refresh_token=…` in
 *  the URL. This component:
 *  1. Parses those tokens from the hash
 *  2. Stores a real session via supabase.auth.setSession
 *  3. Strips the hash so the URL is clean (and safe to share)
 *  4. Refreshes server components so the page re-renders as signed-in
 *
 *  If the user was meant to land on a specific page (like the tournament
 *  registration splash) the email link already includes that path; we
 *  just swap the session in place without redirecting. */
export function AuthHashBootstrap() {
  const router = useRouter();
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash;
    if (!hash || !hash.includes("access_token=")) return;

    const params = new URLSearchParams(hash.replace(/^#/, ""));
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (!accessToken || !refreshToken) return;

    (async () => {
      const supabase = createClient();
      const { error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });
      // Clear the hash either way so tokens don't linger in the URL bar
      history.replaceState(null, "", window.location.pathname + window.location.search);
      if (!error) router.refresh();
    })();
  }, [router]);

  return null;
}
