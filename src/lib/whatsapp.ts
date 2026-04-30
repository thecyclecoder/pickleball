/**
 * WhatsApp Cloud API — outbound template sender.
 *
 * Templates have to be pre-approved by Meta before they can be sent
 * (see docs in CLAUDE.md). This helper just wraps the
 * /messages endpoint with token + phone-number-id from env, normalizes
 * the recipient phone (digits, country code), and surfaces errors.
 *
 * Failures don't throw — call sites typically don't want a delivery
 * problem to block the underlying action (e.g. a match score should
 * still get recorded even if WhatsApp is down). Callers inspect
 * `ok` + `error` on the returned object.
 */

import { normalizePhone } from "./phone";

const GRAPH_API_VERSION = "v21.0";

export type WhatsAppTextParam = { type: "text"; text: string };
export type WhatsAppComponent =
  | { type: "body"; parameters: WhatsAppTextParam[] }
  | { type: "header"; parameters: WhatsAppTextParam[] };

export type SendTemplateResult =
  | { ok: true; messageId?: string }
  | { ok: false; error: string };

export async function sendTemplate(opts: {
  to: string;
  template: string;
  language?: string;
  bodyParams?: string[];
}): Promise<SendTemplateResult> {
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  const token = process.env.META_WHATSAPP_ACCESS_TOKEN?.trim();
  if (!phoneNumberId || !token) {
    return { ok: false, error: "WhatsApp not configured (missing env vars)" };
  }

  const digits = normalizePhone(opts.to);
  if (!digits) {
    return { ok: false, error: `Invalid recipient phone: ${opts.to}` };
  }

  const components: WhatsAppComponent[] = [];
  if (opts.bodyParams && opts.bodyParams.length > 0) {
    components.push({
      type: "body",
      parameters: opts.bodyParams.map((p) => ({ type: "text", text: p })),
    });
  }

  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to: digits,
    type: "template",
    template: {
      name: opts.template,
      language: { code: opts.language ?? "en_US" },
      components,
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    const data: unknown = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errMsg =
        (data as { error?: { message?: string; code?: number } })?.error?.message ??
        `HTTP ${res.status}`;
      return { ok: false, error: errMsg };
    }
    const messageId = (data as { messages?: { id?: string }[] })?.messages?.[0]?.id;
    return { ok: true, messageId };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
