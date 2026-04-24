import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { SignupForm } from "./signup-form";
import { Logo } from "@/components/logo";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(sp.next || "/me");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
        <div className="mb-4 flex justify-center text-white">
          <Logo height={36} />
        </div>
        <p className="mb-6 text-center text-xs uppercase tracking-[0.2em] text-zinc-500">
          Create account
        </p>

        <SignupForm next={sp.next} />

        <p className="mt-6 text-center text-xs text-zinc-500">
          Already have an account?{" "}
          <Link
            href={sp.next ? `/login?next=${encodeURIComponent(sp.next)}` : "/login"}
            className="text-emerald-400 hover:text-emerald-300"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
