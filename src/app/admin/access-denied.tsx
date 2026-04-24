import Link from "next/link";

export function AccessDenied({ email }: { email?: string }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <h1 className="mb-2 text-2xl font-semibold text-white">Access denied</h1>
        <p className="mb-5 text-sm text-zinc-400">
          {email ? (
            <>
              <span className="text-zinc-300">{email}</span> is not a member of this workspace.
              <br />
              Ask an owner to send you an invite.
            </>
          ) : (
            <>You don&apos;t have access to this area.</>
          )}
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
        >
          Back to sign in
        </Link>
      </div>
    </div>
  );
}
