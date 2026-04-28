"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Handles the URL-hash-based implicit flow that Supabase uses for
 *  admin-generated magic links. When a recipient clicks the link in an
 *  email, they land on our site with `#access_token=…&refresh_token=…` in
 *  the URL.
 *
 *  Flow:
 *  1. Parse the tokens from the hash
 *  2. Call supabase.auth.setSession — @supabase/ssr persists to cookies,
 *     so subsequent SSR sees the user signed-in
 *  3. Navigate to /me (player dashboard) — we always do this for a magic
 *     link sign-in rather than relying on Supabase's redirect_to, which
 *     sometimes silently rewrites back to the Site URL root. */
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
      history.replaceState(null, "", window.location.pathname + window.location.search);
      if (!error) {
        // Default destination after a magic link is /me, but if Supabase
        // already landed them on a specific route (e.g. /admin from an
        // invite email), respect it.
        if (window.location.pathname === "/") {
          router.replace("/me");
        } else {
          router.refresh();
        }
      }
    })();
  }, [router]);

  return null;
}
