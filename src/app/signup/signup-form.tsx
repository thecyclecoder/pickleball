"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sentVerification, setSentVerification] = useState(false);

  const nextPath = next && next.startsWith("/") ? next : "/me";

  async function signUpGoogle() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
      },
    });
  }

  async function signUpPassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSubmitting(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { first_name: firstName, last_name: lastName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      });
      if (error) throw error;

      // If the project requires email confirmation, Supabase returns a user
      // with no session. Show a "check your inbox" message in that case.
      if (!data.session) {
        setSentVerification(true);
      } else {
        router.push(nextPath);
        router.refresh();
      }
    } catch (e) {
      setErr((e as Error).message || "Sign-up failed");
    } finally {
      setSubmitting(false);
    }
  }

  if (sentVerification) {
    return (
      <div className="rounded-lg border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200">
        We sent a verification link to <strong>{email}</strong>. Click it to finish setting up your
        account.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={signUpGoogle}
        className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-zinc-700"
      >
        <GoogleIcon />
        Continue with Google
      </button>

      <div className="flex items-center gap-3 text-[10px] uppercase tracking-wider text-zinc-600">
        <span className="h-px flex-1 bg-zinc-800" />
        or
        <span className="h-px flex-1 bg-zinc-800" />
      </div>

      <form onSubmit={signUpPassword} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <input
            type="text"
            required
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="First name"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
          />
          <input
            type="text"
            required
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            placeholder="Last name"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
          />
        </div>
        <input
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2.5 text-sm text-white focus:border-emerald-600 focus:outline-none"
        />
        {err && (
          <p className="rounded-lg border border-red-900 bg-red-950/40 px-3 py-2 text-xs text-red-300">
            {err}
          </p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 disabled:bg-zinc-800"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>
      </form>
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
