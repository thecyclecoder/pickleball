"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function InviteAcceptClient({
  inviteId,
  invitedEmail,
  currentUserEmail,
}: {
  inviteId: string;
  invitedEmail: string;
  currentUserEmail: string | null;
}) {
  const [sending, setSending] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/admin`,
        queryParams: { login_hint: invitedEmail },
      },
    });
  }

  async function switchAccount() {
    const supabase = createClient();
    await supabase.auth.signOut();
    await signInGoogle();
  }

  async function sendMagicLink() {
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/invites/${inviteId}/magic-link`, { method: "POST" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't send link");
      setSentTo(body.email ?? invitedEmail);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (currentUserEmail) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          You&apos;re signed in as <strong>{currentUserEmail}</strong>, but this invite is for{" "}
          <strong>{invitedEmail}</strong>. Sign in with the correct account to accept.
        </div>
        <button
          onClick={switchAccount}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
        >
          Switch Google account
        </button>
      </div>
    );
  }

  if (sentTo) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200">
          Check your inbox. We sent a sign-in link to <strong>{sentTo}</strong>. Click it to accept the
          invite — no password needed.
        </div>
        <button
          type="button"
          onClick={() => setSentTo(null)}
          className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300"
        >
          ← Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <button
        onClick={signInGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white hover:border-zinc-700"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-zinc-600">
        <span className="h-px flex-1 bg-zinc-800" />
        or
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <button
        type="button"
        onClick={sendMagicLink}
        disabled={sending}
        className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-zinc-800"
      >
        {sending ? "Sending…" : `Email me a sign-in link`}
      </button>
      <p className="text-center text-[11px] text-zinc-500">
        We&apos;ll send a magic link to <strong className="text-zinc-300">{invitedEmail}</strong>.
      </p>

      {error && (
        <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.61 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.39-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 01-4.084 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
