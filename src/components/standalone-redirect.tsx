"use client";

import { useEffect } from "react";

/** For users who installed the PWA before the manifest's start_url
 *  was updated to /launch: their home button still opens "/". This
 *  component sniffs display-mode on mount and, if we're running as
 *  an installed PWA, forwards to /launch so the server can route
 *  them to /admin or /me based on auth. No-op in a regular browser. */
export function StandaloneRedirect() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    // Honor explicit "take me home" intent (set by Logo clicks).
    try {
      if (sessionStorage.getItem("skip_launch_redirect") === "1") {
        sessionStorage.removeItem("skip_launch_redirect");
        return;
      }
    } catch {}

    const standalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      // iOS Safari exposes its own flag
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (standalone) {
      window.location.replace("/launch");
    }
  }, []);
  return null;
}
