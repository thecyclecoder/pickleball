import { Resend } from "resend";
import { createAdminClient } from "./supabase/admin";

const RESEND_KEY = process.env.RESEND_API_KEY;
const FROM = process.env.EMAIL_FROM || "Buen Tiro <no-reply@buentiro.app>";
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://buentiro.app";

function resend(): Resend {
  if (!RESEND_KEY) throw new Error("RESEND_API_KEY is not configured");
  return new Resend(RESEND_KEY);
}

/** Generate a passwordless "magic link" for this email.
 *
 *  When the recipient clicks it, they're signed in and dropped on their
 *  profile page (/me) — that final redirect is controlled by our
 *  <AuthHashBootstrap>, not by Supabase's redirect_to, because Supabase
 *  sometimes silently rewrites the redirect to the Site URL root. We
 *  still pass a redirect_to so the verify endpoint has somewhere to
 *  land, but the final page is always /me.
 *
 *  Two subtleties:
 *
 *  1) Create the user first. For a brand-new email, generateLink(type=
 *     "magiclink") falls back to signup semantics; creating the user
 *     up front (idempotent) guarantees a true magic-link.
 *
 *  2) The raw Supabase verify URL is wrapped in our own /auth/confirm
 *     page, because single-use tokens get consumed by email link
 *     scanners (Gmail, Outlook, Proofpoint) before the human clicks.
 *     The wrapper uses client-side JS for the final navigation, which
 *     scanners can't execute. */
export async function generateMagicLink(email: string): Promise<string> {
  const admin = createAdminClient();

  // Idempotent — Supabase's admin SDK returns errors in-band rather than
  // throwing, so ignoring a possible "already registered" is safe.
  await admin.auth.admin.createUser({ email, email_confirm: true });

  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
    // Land the recipient directly on /me so they don't briefly see the
    // landing page before <AuthHashBootstrap> processes the hash tokens.
    // If Supabase ever falls back to Site URL root, the bootstrap still
    // catches and routes them to /me (just with a brief flash).
    options: { redirectTo: `${SITE_URL}/me` },
  });
  if (error) throw new Error(`generateLink: ${error.message}`);
  const verifyUrl = data?.properties?.action_link;
  if (!verifyUrl) throw new Error("generateLink: no action_link returned");

  const encoded = Buffer.from(verifyUrl, "utf8").toString("base64url");
  return `${SITE_URL}/auth/confirm?v=${encoded}`;
}

type RegistrationEmailArgs = {
  toEmail: string;
  toFirstName: string;
  partnerFullName: string;
  tournamentTitle: string;
  tournamentStartDateLabel: string; // e.g. "May 10, 2026"
  tournamentTimeLabel: string; // e.g. "6:00 PM AST"
  tournamentLocation: string;
  categoryLabel: string;
  tournamentUrl: string; // public detail page
  confirmLink: string; // magic link
  waitlisted: boolean;
  mode: "self" | "partner";
  /** First name of the partner who submitted the registration (mode=partner only) */
  submitterFirstName?: string;
};

function registrationEmailHtml(args: RegistrationEmailArgs): { subject: string; html: string; text: string } {
  const {
    toFirstName,
    partnerFullName,
    tournamentTitle,
    tournamentStartDateLabel,
    tournamentTimeLabel,
    tournamentLocation,
    categoryLabel,
    tournamentUrl,
    confirmLink,
    waitlisted,
    mode,
    submitterFirstName,
  } = args;

  const waitlistLine = waitlisted
    ? `You're on the <strong>waitlist</strong> — we'll email you if a spot opens.`
    : "";

  const ctaLabel = "Confirm your spot";
  const headline =
    mode === "self"
      ? waitlisted
        ? `You're on the waitlist for ${tournamentTitle}`
        : `You're registered for ${tournamentTitle}`
      : `${submitterFirstName ?? "Your partner"} signed you up for ${tournamentTitle}`;

  const intro =
    mode === "self"
      ? `Hi ${toFirstName}, you just registered <strong>you</strong> and <strong>${partnerFullName}</strong> for <strong>${tournamentTitle}</strong>. ${waitlistLine}`
      : `Hi ${toFirstName}, <strong>${submitterFirstName ?? partnerFullName}</strong> signed you up as their partner for <strong>${tournamentTitle}</strong>. ${waitlistLine}`;

  const ctaHelp =
    mode === "self"
      ? "Click the button below to confirm your spot and access your tournament dashboard. This link signs you in — no password needed."
      : "Click the button below to confirm your spot. This link signs you in — no password needed.";

  const subject =
    mode === "self"
      ? waitlisted
        ? `Waitlist confirmation: ${tournamentTitle}`
        : `You're registered: ${tournamentTitle}`
      : `${submitterFirstName ?? "A partner"} signed you up for ${tournamentTitle}`;

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#09090b;color:#fafafa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09090b;padding:24px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;width:100%;background:#18181b;border:1px solid #27272a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 16px;">
              <div style="font-size:20px;font-weight:700;letter-spacing:-0.5px;color:#fafafa;">Buen Tiro</div>
              <div style="height:2px;width:40px;background:#10b981;border-radius:2px;margin-top:6px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 8px;">
              <h1 style="margin:0 0 8px;font-size:22px;line-height:1.25;color:#fafafa;font-weight:700;">${escapeHtml(headline)}</h1>
              <p style="margin:0 0 16px;font-size:14px;line-height:1.55;color:#a1a1aa;">${intro}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#09090b;border:1px solid #27272a;border-radius:12px;">
                <tr>
                  <td style="padding:14px 16px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;">Category</div>
                    <div style="font-size:14px;color:#fafafa;margin-top:2px;">${escapeHtml(categoryLabel)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 14px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;">When</div>
                    <div style="font-size:14px;color:#fafafa;margin-top:2px;">${escapeHtml(tournamentStartDateLabel)} · ${escapeHtml(tournamentTimeLabel)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 14px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;">Where</div>
                    <div style="font-size:14px;color:#fafafa;margin-top:2px;">${escapeHtml(tournamentLocation)}</div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 16px 14px;">
                    <div style="font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#71717a;">Partner</div>
                    <div style="font-size:14px;color:#fafafa;margin-top:2px;">${escapeHtml(partnerFullName)}</div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 28px 12px;">
              <p style="margin:0 0 12px;font-size:13px;color:#a1a1aa;line-height:1.55;">${ctaHelp}</p>
              <a href="${confirmLink}" style="display:inline-block;background:#10b981;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 22px;border-radius:10px;">${ctaLabel}</a>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 28px 28px;">
              <p style="margin:0;font-size:12px;color:#71717a;line-height:1.55;">Tournament details: <a href="${tournamentUrl}" style="color:#34d399;text-decoration:none;">${escapeHtml(tournamentUrl)}</a></p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#52525b;">Puerto Rico Pickleball · <a href="${SITE_URL}" style="color:#52525b;text-decoration:none;">buentiro.app</a></p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${headline}

${stripHtml(intro)}

Category: ${categoryLabel}
When: ${tournamentStartDateLabel} · ${tournamentTimeLabel}
Where: ${tournamentLocation}
Partner: ${partnerFullName}

Confirm your spot: ${confirmLink}

Tournament details: ${tournamentUrl}

— Buen Tiro (${SITE_URL})`;

  return { subject, html, text };
}

export async function sendRegistrationEmail(args: RegistrationEmailArgs): Promise<void> {
  const { subject, html, text } = registrationEmailHtml(args);
  const { error } = await resend().emails.send({
    from: FROM,
    to: args.toEmail,
    subject,
    html,
    text,
  });
  if (error) {
    // Log but don't crash the registration response
    console.error("Resend send error:", error, "to:", args.toEmail);
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}
