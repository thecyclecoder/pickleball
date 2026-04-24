import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) {
    // Already signed in — send them where they wanted to go, or /me
    redirect(sp.next || "/me");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-4 flex justify-center text-white">
          <Logo height={36} />
        </div>
        <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
          Sign in or sign up
        </p>

        <LoginForm next={sp.next} error={sp.error} />
      </div>
    </div>
  );
}
