/**
 * Phone-number helpers for WhatsApp deep links.
 *
 * People in PR enter their number every which way: "(858) 334-9198",
 * "858-334-9198", "8583349198", "+18583349198". WhatsApp's `wa.me/`
 * scheme expects digits-only with the country code prefix and no `+`.
 *
 * Heuristic: strip non-digits, then assume +1 (US/PR) when the result
 * is 10 digits. That's right ~99% of the time for our user base; if a
 * European or LatAm-non-PR coach enters a number with a non-1 country
 * code, they need to type the leading digits themselves (or +51 / +52
 * / etc.) and we'll respect what they entered.
 */

const DEFAULT_COUNTRY_CODE = "1";

/** Returns digits-only phone with country code, or null if not parseable. */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  // Preserve a leading + signal so we can tell "they typed a country
  // code" from "they typed a 10-digit local number".
  const hadPlus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length === 0) return null;
  if (hadPlus) return digits;
  if (digits.length === 10) return `${DEFAULT_COUNTRY_CODE}${digits}`;
  // 11+ digits — assume they typed the country code (with or without +).
  return digits;
}

/** wa.me URL with optional prefilled message. Returns null if phone isn't parseable. */
export function whatsappUrl(rawPhone: string | null | undefined, message?: string): string | null {
  const digits = normalizePhone(rawPhone);
  if (!digits) return null;
  const base = `https://wa.me/${digits}`;
  if (message && message.trim()) {
    return `${base}?text=${encodeURIComponent(message.trim())}`;
  }
  return base;
}
