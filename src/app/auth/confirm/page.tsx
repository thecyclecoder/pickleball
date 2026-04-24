import { Logo } from "@/components/logo";
import { ConfirmRedirect } from "./confirm-redirect";

export const dynamic = "force-dynamic";

/** Landing page for magic-link emails. The Supabase verify URL is passed
 *  as a base64url-encoded `v` param. We validate it's a Supabase auth URL
 *  (open-redirect defense) and then the client-side <ConfirmRedirect>
 *  navigates to it on mount.
 *
 *  Why not just redirect server-side? Email link scanners (Gmail, Outlook,
 *  Proofpoint) prefetch the URL in the email to scan it — that would
 *  consume the single-use token before the human ever clicks. They don't
 *  execute JS, so the client-side redirect is safe from prefetching. */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ v?: string }>;
}) {
  const sp = await searchParams;
  const encoded = sp.v ?? "";
  let target: string | null = null;
  try {
    if (encoded) {
      const decoded = Buffer.from(encoded, "base64url").toString("utf8");
      const u = new URL(decoded);
      if (u.hostname.endsWith(".supabase.co") && u.pathname.startsWith("/auth/")) {
        target = decoded;
      }
    }
  } catch {
    target = null;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12">
      <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">
        <div className="mb-4 flex justify-center text-white">
          <Logo height={32} />
        </div>
        {target ? (
          <ConfirmRedirect target={target} />
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold text-white">This link looks off</h1>
            <p className="text-sm text-zinc-400">
              The confirmation URL is missing or malformed. Please use the link sent to your email.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
