import Link from "next/link";
import { Logo } from "@/components/logo";

export function AccessDenied({ email }: { email?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <div className="mb-5 flex justify-center text-white">
          <Logo height={28} />
        </div>
        <h1 className="mb-2 text-2xl font-semibold text-white">Admin access only</h1>
        <p className="mb-5 text-sm text-zinc-400">
          {email ? (
            <>
              <span className="text-zinc-300">{email}</span> is not a member of this workspace. Ask an
              owner to invite you, or continue to your player profile.
            </>
          ) : (
            <>You don&apos;t have access to the admin area.</>
          )}
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href="/me"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500"
          >
            Go to my profile →
          </Link>
          <Link
            href="/"
            className="rounded-lg border border-zinc-800 px-4 py-2 text-sm text-zinc-300 hover:border-zinc-700 hover:text-white"
          >
            Back home
          </Link>
        </div>
      </div>
    </div>
  );
}
