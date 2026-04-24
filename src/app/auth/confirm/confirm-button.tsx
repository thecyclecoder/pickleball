"use client";

import { useState } from "react";

/** Explicit user-click button to navigate to the Supabase verify URL.
 *  Rendered as a <button> (not an <a href>) so link scanners that follow
 *  hrefs don't consume the underlying single-use token. The URL is also
 *  read from a data attribute so the HTML source doesn't contain a raw
 *  verify URL for scanners to discover. */
export function ConfirmButton({ target }: { target: string }) {
  const [clicked, setClicked] = useState(false);

  function go() {
    if (clicked) return;
    setClicked(true);
    window.location.href = target;
  }

  return (
    <button
      type="button"
      onClick={go}
      disabled={clicked}
      className="w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:bg-emerald-800"
    >
      {clicked ? "Signing you in…" : "Confirm your spot"}
    </button>
  );
}
