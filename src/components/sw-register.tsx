"use client";

import { useEffect } from "react";

/** Registers /sw.js. We deliberately do NOT auto-reload the tab when a new
 *  SW takes control: doing so was racing with in-flight Google OAuth
 *  redirects (the user clicks "Continue with Google", a new SW activates
 *  while the redirect is in flight, the tab reloads, the OAuth state is
 *  lost) and forcing users to retry sign-in. Since the SW no longer
 *  caches HTML, the user's NEXT navigation already pulls the fresh UI —
 *  no need to force-reload mid-page. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.log("SW registration failed:", err);
    });
  }, []);
  return null;
}
