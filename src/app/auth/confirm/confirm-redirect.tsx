"use client";

import { useEffect } from "react";

/** Client-side auto-navigate to the decoded Supabase verify URL. Email
 *  link scanners (Gmail, Outlook, etc.) don't execute JS, so they never
 *  trigger the navigation and the single-use token stays fresh. Real
 *  browsers run this on mount and the user is instantly signed in.
 *
 *  The URL is passed via props rather than rendered as an <a href> so it
 *  doesn't sit in the page source where a scraping scanner could find it. */
export function ConfirmRedirect({ target }: { target: string }) {
  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <p className="text-sm text-zinc-400">Signing you in…</p>
  );
}
