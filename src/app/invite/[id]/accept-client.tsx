"use client";

import { createClient } from "@/lib/supabase/client";

export function InviteAcceptClient({
  invitedEmail,
  currentUserEmail,
}: {
  invitedEmail: string;
  currentUserEmail: string | null;
}) {
  async function signIn() {
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
    await signIn();
  }

  if (currentUserEmail) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
          You&apos;re signed in as <strong>{currentUserEmail}</strong>, but this invite is for{" "}
          <strong>{invitedEmail}</strong>. Sign in with the correct Google account to accept.
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

  return (
    <button
      onClick={signIn}
      className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500"
    >
      Sign in with Google
    </button>
  );
}
