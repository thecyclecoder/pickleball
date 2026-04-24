import { Logo } from "@/components/logo";
import { ConfirmButton } from "./confirm-button";

export const dynamic = "force-dynamic";

/** Landing page for magic-link emails. The Supabase verify URL is passed
 *  as a base64url-encoded `v` param. The user has to click the button to
 *  complete sign-in — email link scanners (Gmail, Outlook, Proofpoint)
 *  only follow href GET requests, so they can't consume the one-shot
 *  token by accident. */
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
      // Only allow Supabase auth verify URLs — defense in depth so this
      // route can't be repurposed as an open redirect.
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
          <>
            <h1 className="mb-2 text-xl font-semibold text-white">Confirm your spot</h1>
            <p className="mb-6 text-sm text-zinc-400">
              Tap below to finish signing in. This link is single-use and expires after one click.
            </p>
            <ConfirmButton target={target} />
          </>
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold text-white">This link looks off</h1>
            <p className="text-sm text-zinc-400">
              The confirmation URL is missing or malformed. Please use the link sent to your email,
              or request a new one from the sign-in page.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
