import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/api";
import { syncCanonicalTemplates, CANONICAL_TEMPLATES } from "@/lib/whatsapp-templates";

/**
 * Owner-only. Pushes the canonical WhatsApp template content (defined
 * in src/lib/whatsapp-templates.ts) to Meta. Each template is dropped
 * and re-created so the live WABA always matches what's in code.
 *
 * Newly created templates land in PENDING status until Meta reviews
 * them. Re-running this endpoint after a template is approved will
 * REPLACE it — Meta needs to re-review the new copy before sends
 * resume. So only run when the canonical body actually changed.
 */
export async function POST() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;

  try {
    const results = await syncCanonicalTemplates();
    return NextResponse.json({
      synced: results,
      canonical: CANONICAL_TEMPLATES.map((t) => ({
        name: t.name,
        category: t.category,
        body: t.body,
      })),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

/** GET — preview canonical templates without pushing. Useful for
 *  comparing what's defined in code vs what's deployed at Meta. */
export async function GET() {
  const auth = await requireOwner();
  if (!auth.ok) return auth.response;
  return NextResponse.json({
    canonical: CANONICAL_TEMPLATES.map((t) => ({
      name: t.name,
      category: t.category,
      language: t.language,
      body: t.body,
      bodyExamples: t.bodyExamples,
    })),
  });
}
