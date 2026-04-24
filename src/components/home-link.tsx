"use client";

import Link from "next/link";
import { Logo } from "./logo";

/** Logo that links to "/" and tells <StandaloneRedirect> to leave the
 *  user on the home page instead of bouncing them to /launch. Only
 *  relevant inside the installed PWA; in a regular browser the flag
 *  does nothing because no redirect runs. */
export function HomeLink({ height = 28 }: { height?: number }) {
  function markIntent() {
    try {
      sessionStorage.setItem("skip_launch_redirect", "1");
    } catch {}
  }
  return (
    <Link
      href="/"
      aria-label="Buen Tiro"
      onClick={markIntent}
      className="text-white"
    >
      <Logo height={height} />
    </Link>
  );
}
