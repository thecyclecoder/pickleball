"use client";

import { createClient } from "@/lib/supabase/client";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  const handleLogin = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <div className="mb-4 flex justify-center text-white">
          <Logo height={36} />
        </div>
        <p className="mb-6 text-xs uppercase tracking-[0.2em] text-zinc-500">Tournament Management</p>
        <button
          onClick={handleLogin}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-emerald-500"
        >
          Sign in with Google
        </button>
      </div>
    </div>
  );
}
