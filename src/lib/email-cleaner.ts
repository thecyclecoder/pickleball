/**
 * Inbound-email body cleaner — strips HTML, quoted history, signatures,
 * and noise. Used on the relay webhook before persisting and forwarding,
 * so the lesson_request_replies thread shows what the sender actually
 * typed instead of "Re: Re: Re: …" cascades.
 *
 * Ported from the ShopCX implementation: the rules survived contact with
 * Gmail, Outlook, Apple Mail, and the usual mobile signature flavors.
 */

import { convert } from "html-to-text";
import EmailReplyParser from "email-reply-parser";

export function cleanEmailBody(rawBody: string, senderEmail?: string): string {
  if (!rawBody || !rawBody.trim()) return rawBody || "";

  let text = rawBody;

  if (/<[a-zA-Z][^>]*>/.test(text)) {
    try {
      text = convert(text, {
        wordwrap: false,
        preserveNewlines: true,
        selectors: [
          { selector: "img", format: "skip" },
          { selector: "style", format: "skip" },
          { selector: "script", format: "skip" },
          { selector: "head", format: "skip" },
          { selector: "a", options: { ignoreHref: true } },
        ],
      });
    } catch {
      text = text.replace(/<[^>]*>/g, " ");
    }
  }

  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&[a-z]+;/gi, " ");

  try {
    const parsed = new EmailReplyParser().read(text);
    const fragments = parsed.getFragments();
    const visible = fragments.filter(
      (f: { isQuoted: () => boolean; isSignature: () => boolean; isHidden: () => boolean }) =>
        !f.isQuoted() && !f.isHidden()
    );
    if (visible.length > 0) {
      text = visible.map((f: { getContent: () => string }) => f.getContent()).join("\n").trim();
    }
  } catch {
    /* fall through */
  }

  text = stripSignature(text, senderEmail);

  // Final regex pass — catches anything the parser missed.
  const lines = text.split("\n");
  const cleaned: string[] = [];
  let truncate = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^[-–—]{2,}\s*$/.test(trimmed)) {
      truncate = true;
      break;
    }
    if (/^Sent from my (iPhone|iPad|Android|Galaxy|Samsung|Pixel)/i.test(trimmed)) continue;
    if (/^Get Outlook for (iOS|Android|Mac|Windows)/i.test(trimmed)) continue;
    if (/^Sent from (Mail|Yahoo|AOL|Outlook)/i.test(trimmed)) continue;
    if (/^Sent via /i.test(trimmed)) continue;
    if (/^>{2,}/.test(trimmed)) continue;
    if (/^On .+ wrote:\s*$/i.test(trimmed)) {
      truncate = true;
      break;
    }
    if (/^(From|To|Date|Subject|Cc|Bcc):\s/i.test(trimmed) && cleaned.length > 0) {
      truncate = true;
      break;
    }
    cleaned.push(line);
  }
  text = (truncate ? cleaned : lines).join("\n");

  text = text.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+/g, " ").trim();

  if (!text) {
    const fallback = rawBody.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
    return fallback.slice(0, 500);
  }

  return text;
}

function stripSignature(text: string, senderEmail?: string): string {
  const lines = text.split("\n");
  const senderLocal = senderEmail?.split("@")[0]?.toLowerCase() ?? "";
  const senderName = senderLocal.replace(/[^a-z]/g, " ").trim();

  let signatureStart = -1;

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (!line) continue;

    const isNameLine = /^[A-Z][a-z]+ [A-Z][a-z]+/.test(line) && line.length < 40;
    const isSenderName = senderName && line.toLowerCase().includes(senderName);

    if (isNameLine || isSenderName) {
      const below = lines.slice(i + 1).map((l) => l.trim()).filter((l) => l);
      const sigPatterns = [
        /^(Founder|CEO|President|Director|Manager|Support|Sales|VP|CTO|COO|CFO|Owner|Partner|Coach|Pro|Instructor)/i,
        /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/,
        /[\w.+-]+@[\w.-]+\.\w+/,
        /^https?:\/\//,
        /^\d+\s+\w+\s+(Street|St|Ave|Avenue|Blvd|Road|Rd|Drive|Dr|Lane|Ln|Way|Court|Ct|Suite|Ste|Unit)/i,
        /^[A-Z][a-z]+,\s*[A-Z]{2}\s+\d{5}/,
        /\|/,
        /^www\./i,
      ];
      const sigLineCount = below.filter((l) => sigPatterns.some((p) => p.test(l))).length;
      if (sigLineCount >= 2 || (isSenderName && sigLineCount >= 1)) {
        signatureStart = i;
        break;
      }
    }
    if (lines.length - i > 15) break;
  }

  if (signatureStart >= 0) return lines.slice(0, signatureStart).join("\n").trim();
  return text;
}
