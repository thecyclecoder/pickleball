"use client";

import { useState } from "react";

export function CoachShareLinks({
  slug,
  status,
}: {
  slug: string;
  status: "draft" | "published";
}) {
  const [origin, setOrigin] = useState<string>("");
  const [copied, setCopied] = useState<string | null>(null);

  // Resolve the absolute URL on the client so we don't have to wire
  // NEXT_PUBLIC_SITE_URL through the server tree just for this. Falls
  // back to a relative URL in case window isn't available yet.
  if (typeof window !== "undefined" && !origin) {
    setOrigin(window.location.origin);
  }

  if (status === "draft") {
    return (
      <div className="rounded-xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
        Profile is in <strong>draft</strong> — share links will work once you set status to{" "}
        <strong>published</strong>.
      </div>
    );
  }

  const longUrl = origin ? `${origin}/coaches/${slug}` : `/coaches/${slug}`;
  const shortUrl = origin ? `${origin}/c/${slug}` : `/c/${slug}`;

  async function copy(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(url);
      setTimeout(() => setCopied((v) => (v === url ? null : v)), 1500);
    } catch {
      // Older browsers — fall back to a temporary input element
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand("copy");
        setCopied(url);
        setTimeout(() => setCopied((v) => (v === url ? null : v)), 1500);
      } finally {
        ta.remove();
      }
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-5">
      <div>
        <h2 className="text-sm font-semibold text-white">Share your profile</h2>
        <p className="mt-0.5 text-xs text-zinc-500">
          The short link is great for &ldquo;link in bio&rdquo; on Instagram, TikTok, etc.
        </p>
      </div>
      <Row label="Short link" url={shortUrl} copied={copied} onCopy={copy} />
      <Row label="Full link" url={longUrl} copied={copied} onCopy={copy} />
    </div>
  );
}

function Row({
  label,
  url,
  copied,
  onCopy,
}: {
  label: string;
  url: string;
  copied: string | null;
  onCopy: (url: string) => void;
}) {
  const isCopied = copied === url;
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-emerald-400 hover:text-emerald-300"
        >
          Open ↗
        </a>
      </div>
      <div className="flex items-stretch overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950">
        <input
          readOnly
          value={url}
          onFocus={(e) => e.currentTarget.select()}
          className="min-w-0 flex-1 bg-transparent px-3 py-2 text-xs text-zinc-200 outline-none"
        />
        <button
          type="button"
          onClick={() => onCopy(url)}
          className={`shrink-0 border-l border-zinc-800 px-3 text-xs font-medium transition-colors ${
            isCopied
              ? "bg-emerald-600/20 text-emerald-300"
              : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
          }`}
        >
          {isCopied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
